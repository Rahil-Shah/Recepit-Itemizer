namespace ReceiptRing.UI {
  // The landing page is static markup; the only behaviour it needs is the
  // mobile menu and a way to hand a visitor to the auth dialog in the right
  // mode. Everything else (smooth scrolling to sections, the accordion) is
  // native.
  export class LandingView {
    constructor(private readonly elements: DomRegistry) {}

    /**
     * @param openApp Takes a signed-in visitor back to the workspace. They
     *   reach this page from the app's logo, so every call to action here --
     *   "Get started", "Start splitting" -- means "back to my receipts" for
     *   them rather than a sign-up form.
     */
    init(openAuth: (mode: "login" | "register") => void, openApp: () => void): void {
      const { landingMenu, landingMenuToggle } = this.elements;

      landingMenuToggle.addEventListener("click", () => {
        this.setMenuOpen(!landingMenu.classList.contains("is-open"));
      });

      // Following a section link should also fold the menu away, or it sits
      // over the very section the reader asked for.
      landingMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => this.setMenuOpen(false));
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.setMenuOpen(false);
      });

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (landingMenu.contains(target) || landingMenuToggle.contains(target)) return;
        this.setMenuOpen(false);
      });

      // Any button on the page marked with data-auth-action opens the dialog
      // in that mode: "Get started" lands on sign-up, "Log in" on log-in.
      this.elements.authActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setMenuOpen(false);
          if (document.body.dataset.auth === "user") {
            openApp();
            return;
          }
          openAuth(button.dataset.authAction === "register" ? "register" : "login");
        });
      });

      this.elements.openAppButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setMenuOpen(false);
          openApp();
        });
      });
    }

    private setMenuOpen(open: boolean): void {
      const { landingMenu, landingMenuToggle } = this.elements;
      landingMenu.classList.toggle("is-open", open);
      landingMenuToggle.setAttribute("aria-expanded", String(open));
      landingMenuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }
}
