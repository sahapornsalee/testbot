import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Shown in the fallback, e.g. the widget title. */
  label: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Isolates a failing widget so the rest of the page keeps working. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log only the message and stack location; never user data.
    console.error(`Widget "${this.props.label}" crashed:`, error.message, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="widget-error">
        <p>
          <strong>{this.props.label}</strong> เกิดข้อผิดพลาด ส่วนอื่นของหน้ายังใช้งานได้ตามปกติ
        </p>
        <button type="button" className="btn" onClick={() => this.setState({ failed: false })}>
          ลองใหม่
        </button>
      </div>
    );
  }
}
