/*
  Formspree integration
  Bookingforespørgsler sendes direkte fra hjemmesiden til Formspree.
*/
const PP_FORMSPREE_URL = "https://formspree.io/f/mgodovja";

let ppState = {};

function ppFormatKr(amount) {
  return Number(amount).toLocaleString("da-DK") + " kr.";
}

function getEl(id) {
  return document.getElementById(id);
}

function show(id) {
  const el = getEl(id);
  if (el) el.classList.remove("hidden");
}

function hide(id) {
  const el = getEl(id);
  if (el) el.classList.add("hidden");
}

function showError(message) {
  const error = getEl("pp-errorMessage");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
}

function hideError() {
  const error = getEl("pp-errorMessage");
  if (!error) return;
  error.textContent = "";
  error.classList.add("hidden");
}

function calculatePrice() {
  hideError();

  const menu = getEl("pp-menu");
  const personsInput = getEl("pp-persons");
  const delivery = getEl("pp-delivery");

  const selectedMenu = menu.options[menu.selectedIndex];
  const persons = parseInt(personsInput.value || "0", 10);
  const menuPrice = parseInt(menu.value, 10);
  const menuName = selectedMenu.dataset.name;
  const minPersons = parseInt(selectedMenu.dataset.min || "30", 10);
  const outsideMinPersons = parseInt(selectedMenu.dataset.outsideMin || "40", 10);
  const areaRule = selectedMenu.dataset.area || "all";
  const deliveryPrice = parseInt(delivery.value, 10);
  const deliveryLabel = delivery.options[delivery.selectedIndex].dataset.label;

  if (!persons || persons < minPersons) {
    alert(`${menuName} har minimum ${minPersons} personer.`);
    personsInput.value = minPersons;
    return;
  }

  if (areaRule === "esbjerg-only" && deliveryPrice === 1000) {
    alert("Denne menu er lavet til små selskaber indenfor Esbjerg. Vælg levering i Esbjerg eller afhentning/aftales nærmere.");
    delivery.value = "500";
    return;
  }

  if (deliveryPrice === 1000 && persons < outsideMinPersons) {
    alert(`Ved levering udenfor Esbjerg er minimum ${outsideMinPersons} personer.`);
    personsInput.value = outsideMinPersons;
    return;
  }

  const foodPrice = persons * menuPrice;
  const total = foodPrice + deliveryPrice;

  ppState = {
    persons,
    menuPrice,
    menuName,
    minPersons,
    deliveryPrice,
    deliveryLabel,
    foodPrice,
    total,
    totalFormatted: ppFormatKr(total)
  };

  getEl("pp-totalPrice").textContent = ppFormatKr(total);
  getEl("pp-priceDetails").textContent = `${persons} personer · ${menuName} · ${deliveryLabel}`;

  show("pp-priceBox");
  show("pp-leadSection");
  hide("pp-confirmationSection");

  getEl("pp-leadSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function sendOffer() {
  hideError();

  if (!ppState.total) {
    alert("Beregn prisen først.");
    return;
  }

  const name = getEl("pp-name").value.trim();
  const phone = getEl("pp-phone").value.trim();
  const email = getEl("pp-email").value.trim();
  const eventDate = getEl("pp-date").value;
  const eventType = getEl("pp-eventType").value;
  const city = getEl("pp-city").value.trim();
  const preferredTime = getEl("pp-time").value;
  const address = getEl("pp-address").value.trim();
  const notes = getEl("pp-notes").value.trim();

  if (!name || !phone || !email || !eventDate) {
    showError("Udfyld venligst navn, telefon, email og dato.");
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    showError("Indtast venligst en gyldig email.");
    return;
  }

  const eventDateFormatted = eventDate
    ? new Date(eventDate + "T00:00:00").toLocaleDateString("da-DK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
    : "";

  const payload = {
    name,
    phone,
    email,

    // Rå dato fra inputfeltet, fx 2026-07-08
    eventDate,

    // Dansk dato til mailen, fx 08.07.2026
    eventDateFormatted,

    eventType,
    city: city || "Ikke angivet",
    address: address || "Ikke angivet",

    // Begge felter sendes for kompatibilitet
    time: preferredTime || "Ikke angivet",
    preferredTime: preferredTime || "Ikke angivet",

    persons: ppState.persons,
    menuName: ppState.menuName,
    menuPrice: ppState.menuPrice,
    foodPrice: ppState.foodPrice,
    deliveryLabel: ppState.deliveryLabel,
    deliveryPrice: ppState.deliveryPrice,
    total: ppState.total,
    totalFormatted: ppState.totalFormatted,

    notes: notes || "Ingen særlige ønsker angivet.",
    source: "PattePerfekt hjemmeside",
    submittedAt: new Date().toLocaleString("da-DK")
  };

  const sendButton = getEl("sendBtn");
  sendButton.disabled = true;
  sendButton.textContent = "Sender...";

  try {
    if (!PP_FORMSPREE_URL || !PP_FORMSPREE_URL.startsWith("https://formspree.io/f/")) {
      throw new Error("Formspree endpoint mangler eller er ugyldigt i script.js");
    }

    const response = await fetch(PP_FORMSPREE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let message = "Formularen kunne ikke sendes. Prøv igen.";
      try {
        const data = await response.json();
        if (data.errors && data.errors.length) {
          message = data.errors.map((item) => item.message).join(" ");
        }
      } catch (_) {}
      throw new Error(message);
    }

    getEl("pp-thankYouText").textContent =
      `Vi har modtaget dine oplysninger. Vi vender tilbage hurtigst muligt med en bekræftelse.`;

    getEl("pp-confirmationPrice").textContent = ppState.totalFormatted;
    show("pp-confirmationSection");
    getEl("pp-confirmationSection").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error(error);
    showError("Fejl: " + error.message);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send min forespørgsel";
  }
}

function setupNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupMenuMinHelper() {
  const menu = getEl("pp-menu");
  const personsInput = getEl("pp-persons");
  if (!menu || !personsInput) return;

  const syncMin = () => {
    const selectedMenu = menu.options[menu.selectedIndex];
    const minPersons = parseInt(selectedMenu.dataset.min || "30", 10);
    personsInput.min = String(minPersons);
    if (parseInt(personsInput.value || "0", 10) < minPersons) {
      personsInput.value = String(minPersons);
    }
  };

  menu.addEventListener("change", syncMin);
  syncMin();
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupMenuMinHelper();
  getEl("calculateBtn")?.addEventListener("click", calculatePrice);
  getEl("sendBtn")?.addEventListener("click", sendOffer);
});
