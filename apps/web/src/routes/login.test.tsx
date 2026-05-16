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

const loginMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      login: (...args: unknown[]) => loginMock(...args),
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

import { Route } from "./login.tsx";

const LoginPage = (Route as unknown as { component: React.ComponentType }).component;

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginMock.mockReset();
    setUserMock.mockReset();
  });

  test("renders email + password inputs with required attribute", () => {
    render(<LoginPage />);
    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);
    expect(email).toBeInTheDocument();
    expect(email).toBeRequired();
    expect(password).toBeRequired();
    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("type", "password");
  });

  test("calls api.auth.login with form values on submit", async () => {
    loginMock.mockResolvedValue({ user: { id: "1", email: "a@b.com" } });
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "Password123!",
      });
    });
  });

  test("navigates to /app on success", async () => {
    loginMock.mockResolvedValue({ user: { id: "1", email: "a@b.com" } });
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/app" });
    });
  });

  test("shows error message on ApiError", async () => {
    loginMock.mockRejectedValue(
      Object.assign(new Error("Invalid credentials"), {
        status: 401,
      })
    );
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/login failed|invalid credentials/i)).toBeInTheDocument();
    });
  });

  test("submit button disabled while submitting", async () => {
    let resolveFn: (v: unknown) => void = () => undefined;
    loginMock.mockReturnValue(
      new Promise((r) => {
        resolveFn = r;
      })
    );
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    const button = screen.getByRole("button", { name: /sign in/i });
    await user.click(button);
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    resolveFn({ user: { id: "1", email: "a@b.com" } });
  });

  test("links to /signup", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });
});
