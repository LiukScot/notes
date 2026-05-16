import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => navigateMock,
  Link: (props: { children: React.ReactNode; to: string; className?: string; style?: React.CSSProperties }) => (
    <a href={props.to} className={props.className} style={props.style}>
      {props.children}
    </a>
  ),
}));

const signupMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      signup: (...args: unknown[]) => signupMock(...args),
    },
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const setUserMock = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: { setUser: (u: unknown) => void }) => unknown) =>
    selector({ setUser: setUserMock }),
}));

import { Route } from "./signup.tsx";

const SignupPage = (Route as unknown as { component: React.ComponentType }).component;

describe("SignupPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signupMock.mockReset();
    setUserMock.mockReset();
  });

  test("renders name, email, password inputs with required attribute", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/^name$/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });

  test("password input has minLength=8", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("minLength", "8");
  });

  test("calls api.auth.signup with form values on submit", async () => {
    signupMock.mockResolvedValue({ user: { id: "1", email: "new@example.com" } });
    render(<SignupPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "Password123!",
        name: "Alice",
      });
    });
  });

  test("navigates to /app on success and updates store", async () => {
    signupMock.mockResolvedValue({ user: { id: "1", email: "x@e.com" } });
    render(<SignupPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "A");
    await user.type(screen.getByLabelText(/email/i), "x@e.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/app" });
      expect(setUserMock).toHaveBeenCalledWith({ id: "1", email: "x@e.com" });
    });
  });

  test("shows error on signup failure", async () => {
    signupMock.mockRejectedValue(
      Object.assign(new Error("Email already in use"), {
        status: 409,
      })
    );
    render(<SignupPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "A");
    await user.type(screen.getByLabelText(/email/i), "dup@e.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/signup failed|email already in use/i)).toBeInTheDocument();
    });
  });

  test("links to /login", () => {
    render(<SignupPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
