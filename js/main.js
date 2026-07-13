const currentYear = new Date().getFullYear();

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = currentYear;
});

const header = document.querySelector(".site-header");

if (header) {
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}
