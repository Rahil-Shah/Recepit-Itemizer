namespace ReceiptRing.Services {
  export class ImagePreviewService {
    show(file: File, image: HTMLImageElement, container: HTMLElement): void {
      const reader = new FileReader();
      reader.onload = () => {
        image.src = String(reader.result);
        container.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }

    clear(input: HTMLInputElement, image: HTMLImageElement, container: HTMLElement): void {
      input.value = "";
      image.removeAttribute("src");
      container.classList.add("hidden");
    }
  }
}
