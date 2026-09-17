namespace ReceiptRing.UI {
  // The landing page is static markup; the only behaviour it needs is the
  // mobile menu and a way to hand a visitor to the auth dialog in the right
  // mode. Everything else (smooth scrolling to sections, the accordion) is
  // native.
  export class LandingView {
    constructor(private readonly elements: DomRegistry) {}

    init(openAuth: (mode: "login" | "register") => void): void {
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
          openAuth(button.dataset.authAction === "register" ? "register" : "login");
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
