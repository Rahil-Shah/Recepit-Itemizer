namespace ReceiptRing.UI {
  type AuthMode = "login" | "register";

  export class AuthView {
    private mode: AuthMode = "login";
    onAuthenticated: ((user: Services.AuthUser) => void) | null = null;

    constructor(
      private readonly elements: DomRegistry,
      private readonly authApi: Services.AuthApiService
    ) {}

    init(): void {
      this.elements.authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.submit();
      });
      this.elements.authToggle.addEventListener("click", () => {
        this.setMode(this.mode === "login" ? "register" : "login");
      });
      this.setMode("login");
    }

    show(): void {
      this.elements.authOverlay.classList.remove("hidden");
    }

    hide(): void {
      this.elements.authOverlay.classList.add("hidden");
    }

    private setMode(mode: AuthMode): void {
      this.mode = mode;
      const registering = mode === "register";
      this.elements.authTitle.textContent = registering ? "Create account" : "Log in";
      this.elements.authSubmit.textContent = registering ? "Sign up" : "Log in";
      this.elements.authSwitchText.textContent = registering
        ? "Already have an account?"
        : "Need an account?";
      this.elements.authToggle.textContent = registering ? "Log in" : "Sign up";
      this.elements.authNameField.classList.toggle("hidden", !registering);
      this.elements.authPassword.setAttribute(
        "autocomplete",
        registering ? "new-password" : "current-password"
      );
      this.setError("");
    }

    private setError(message: string): void {
      this.elements.authError.textContent = message;
      this.elements.authError.classList.toggle("hidden", message === "");
    }

    private async submit(): Promise<void> {
      const email = this.elements.authEmail.value.trim();
      const password = this.elements.authPassword.value;
      const name = this.elements.authName.value.trim() || null;

      this.setError("");
      this.elements.authSubmit.disabled = true;
      try {
        const user =
          this.mode === "register"
            ? await this.authApi.register(email, password, name)
            : await this.authApi.login(email, password);
        this.elements.authForm.reset();
        this.onAuthenticated?.(user);
      } catch (error) {
        this.setError(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        this.elements.authSubmit.disabled = false;
      }
    }
  }
}
