"""SSRF protections. Uses mock resolvers only; never contacts real internal hosts."""

import ipaddress

import pytest

from app.core.errors import AppError, ErrorCode
from app.core.url_policy import DestinationPolicy, is_public_address
from app.services.safe_http import GuardedNetworkBackend, build_client, open_stream


def resolver_returning(*answers: str):
    async def resolve(host: str, port: int) -> list[str]:
        return list(answers)

    return resolve


BLOCKED_ADDRESSES = [
    "127.0.0.1",
    "127.255.255.254",
    "0.0.0.0",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "100.100.100.200",  # Alibaba metadata
    "169.254.169.254",  # AWS/GCP/Azure metadata
    "169.254.1.1",
    "224.0.0.1",
    "239.255.255.250",
    "255.255.255.255",
    "198.18.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd00:ec2::254",  # AWS IMDS IPv6
    "ff02::1",
    "::ffff:127.0.0.1",  # IPv4-mapped loopback
    "::ffff:169.254.169.254",
    "64:ff9b::a00:1",  # NAT64 of 10.0.0.1
    "2002:7f00:1::",  # 6to4 of 127.0.0.1
]


@pytest.mark.parametrize("address", BLOCKED_ADDRESSES)
def test_non_public_addresses_are_rejected(address: str) -> None:
    assert not is_public_address(ipaddress.ip_address(address))


@pytest.mark.parametrize("address", ["93.184.215.14", "1.1.1.1", "2606:4700:4700::1111"])
def test_public_addresses_are_allowed(address: str) -> None:
    assert is_public_address(ipaddress.ip_address(address))


@pytest.mark.parametrize("address", BLOCKED_ADDRESSES)
async def test_hostname_resolving_to_internal_address_is_blocked(address: str) -> None:
    policy = DestinationPolicy(resolver=resolver_returning(address))
    with pytest.raises(AppError) as info:
        await policy.validate("https://attacker.example/file")
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[fd00:ec2::254]/",
        "http://10.0.0.1:8080/",
        "http://0.0.0.0:8000/",
    ],
)
async def test_ip_literal_urls_are_blocked(url: str) -> None:
    policy = DestinationPolicy(resolver=resolver_returning("1.1.1.1"))
    with pytest.raises(AppError) as info:
        await policy.validate(url)
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION


async def test_mixed_public_and_private_answers_are_blocked() -> None:
    policy = DestinationPolicy(resolver=resolver_returning("1.1.1.1", "10.0.0.1"))
    with pytest.raises(AppError) as info:
        await policy.validate("https://mixed.example/")
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION


async def test_unresolvable_host_is_reported_as_unavailable() -> None:
    async def failing(host: str, port: int) -> list[str]:
        raise OSError("nxdomain")

    policy = DestinationPolicy(resolver=failing)
    with pytest.raises(AppError) as info:
        await policy.validate("https://nothing.example/")
    assert info.value.code == ErrorCode.SOURCE_UNAVAILABLE


async def test_dns_rebinding_is_blocked_at_connect_time() -> None:
    """First lookup (pre-flight) is public, second (connect) is internal."""
    answers = iter([["93.184.215.14"], ["127.0.0.1"]])

    async def rebinding(host: str, port: int) -> list[str]:
        return next(answers)

    policy = DestinationPolicy(resolver=rebinding)
    await policy.validate("https://rebind.example/")  # pre-flight passes
    backend = GuardedNetworkBackend(policy)
    with pytest.raises(AppError) as info:
        await backend.connect_tcp("rebind.example", 443, timeout=1)
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION


async def test_client_never_connects_to_internal_address_even_without_preflight() -> None:
    policy = DestinationPolicy(resolver=resolver_returning("127.0.0.1"))
    async with build_client(policy, 1, 1) as client:
        with pytest.raises(AppError) as info:
            async with open_stream(client, "https://rebind.example/", max_redirects=2):
                pass
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION


async def test_unix_sockets_are_refused() -> None:
    backend = GuardedNetworkBackend(DestinationPolicy())
    with pytest.raises(AppError):
        await backend.connect_unix_socket("/var/run/docker.sock")


@pytest.mark.parametrize(
    "path",
    ["/redirect-internal", "/redirect-metadata", "/redirect-loopback-alias"],
)
async def test_redirect_to_internal_destination_is_blocked(fixture_server: str, path: str) -> None:
    policy = DestinationPolicy(extra_allowed_networks=["127.0.0.1/32"])
    async with build_client(policy, 2, 2) as client:
        with pytest.raises(AppError) as info:
            async with open_stream(client, fixture_server + path, max_redirects=5):
                pass
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION


async def test_redirect_loop_is_limited(fixture_server: str) -> None:
    policy = DestinationPolicy(extra_allowed_networks=["127.0.0.1/32"])
    async with build_client(policy, 2, 2) as client:
        with pytest.raises(AppError) as info:
            async with open_stream(client, fixture_server + "/redirect-loop", max_redirects=3):
                pass
    assert info.value.code == ErrorCode.TOO_MANY_REDIRECTS


async def test_without_test_allowlist_the_fixture_server_is_blocked(fixture_server: str) -> None:
    async with build_client(DestinationPolicy(), 2, 2) as client:
        with pytest.raises(AppError) as info:
            async with open_stream(client, fixture_server + "/image.png", max_redirects=1):
                pass
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION
