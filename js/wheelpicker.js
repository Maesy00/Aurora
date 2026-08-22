/*
 * wheelpicker.js — molettes de saisie (façon iOS) pour la durée et la
 * distance. Chaque molette est une liste défilante avec accroche
 * (scroll-snap) ; la valeur retenue est celle centrée dans le cadre.
 */

const WHEEL_ITEM_HEIGHT = 34;

function createWheel(container, values, formatFn) {
  container.innerHTML = "";
  values.forEach((value) => {
    const item = document.createElement("div");
    item.className = "wheel-item";
    item.textContent = formatFn ? formatFn(value) : value;
    container.appendChild(item);
  });

  function clampIndex(index) {
    return Math.max(0, Math.min(values.length - 1, index));
  }

  function currentIndex() {
    return clampIndex(Math.round(container.scrollTop / WHEEL_ITEM_HEIGHT));
  }

  function updateActive() {
    const index = currentIndex();
    [...container.children].forEach((child, i) =>
      child.classList.toggle("active", i === index)
    );
  }

  let settleTimeout;
  container.addEventListener("scroll", () => {
    updateActive();
    clearTimeout(settleTimeout);
    settleTimeout = setTimeout(() => {
      container.scrollTo({ top: currentIndex() * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
    }, 120);
  });

  return {
    setIndex(index, instant) {
      container.scrollTo({
        top: clampIndex(index) * WHEEL_ITEM_HEIGHT,
        behavior: instant ? "auto" : "smooth",
      });
      requestAnimationFrame(updateActive);
    },
    getValue() {
      return values[currentIndex()];
    },
  };
}

function closeWheelPopovers() {
  document.getElementById("duration-popover").hidden = true;
  document.getElementById("distance-popover").hidden = true;
}

/* --- Durée (heures / minutes) --- */

const durationTrigger = document.getElementById("duration-trigger");
const durationLabel = document.getElementById("duration-trigger-label");
const durationHidden = document.getElementById("session-duration");
const durationPopover = document.getElementById("duration-popover");

const hoursWheel = createWheel(
  document.getElementById("wheel-hours"),
  Array.from({ length: 16 }, (_, i) => i)
);
const minutesWheel = createWheel(
  document.getElementById("wheel-minutes"),
  Array.from({ length: 60 }, (_, i) => i),
  (v) => String(v).padStart(2, "0")
);

function setDuration(hours, minutes, instant) {
  hoursWheel.setIndex(hours, instant);
  minutesWheel.setIndex(minutes, instant);
  durationHidden.value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  durationLabel.textContent = hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}

function commitDuration() {
  setDuration(hoursWheel.getValue(), minutesWheel.getValue());
  durationPopover.hidden = true;
}

durationTrigger.addEventListener("click", (event) => {
  event.stopPropagation();
  const wasHidden = durationPopover.hidden;
  document.getElementById("date-popover").hidden = true;
  closeWheelPopovers();
  durationPopover.hidden = !wasHidden;

  if (wasHidden) {
    const [h, m] = durationHidden.value.split(":").map(Number);
    hoursWheel.setIndex(h || 0, true);
    minutesWheel.setIndex(m || 0, true);
  }
});

document.getElementById("duration-done").addEventListener("click", commitDuration);

/* --- Distance (km + dixièmes) --- */

const distanceTrigger = document.getElementById("distance-trigger");
const distanceLabel = document.getElementById("distance-trigger-label");
const distanceHidden = document.getElementById("session-distance");
const distancePopover = document.getElementById("distance-popover");

const kmWheel = createWheel(
  document.getElementById("wheel-km"),
  Array.from({ length: 201 }, (_, i) => i)
);
const kmDecimalWheel = createWheel(
  document.getElementById("wheel-km-decimal"),
  Array.from({ length: 10 }, (_, i) => i)
);

function setDistance(km, decimal, instant) {
  kmWheel.setIndex(km, instant);
  kmDecimalWheel.setIndex(decimal, instant);
  distanceHidden.value = `${km}.${decimal}`;
  distanceLabel.textContent = `${km},${decimal} km`;
  distanceLabel.classList.remove("placeholder-text");
}

function clearDistance() {
  distanceHidden.value = "";
  distanceLabel.textContent = "Ajouter une distance";
  distanceLabel.classList.add("placeholder-text");
  kmWheel.setIndex(0, true);
  kmDecimalWheel.setIndex(0, true);
}

function commitDistance() {
  setDistance(kmWheel.getValue(), kmDecimalWheel.getValue());
  distancePopover.hidden = true;
}

distanceTrigger.addEventListener("click", (event) => {
  event.stopPropagation();
  const wasHidden = distancePopover.hidden;
  document.getElementById("date-popover").hidden = true;
  closeWheelPopovers();
  distancePopover.hidden = !wasHidden;

  if (wasHidden) {
    const [km, decimal] = (distanceHidden.value || "0.0").split(".").map(Number);
    kmWheel.setIndex(km || 0, true);
    kmDecimalWheel.setIndex(decimal || 0, true);
  }
});

document.getElementById("distance-done").addEventListener("click", commitDistance);
document.getElementById("distance-clear").addEventListener("click", () => {
  clearDistance();
  distancePopover.hidden = true;
});

document.addEventListener("click", (event) => {
  if (!durationPopover.hidden && !durationPopover.contains(event.target) && event.target !== durationTrigger) {
    commitDuration();
  }
  if (!distancePopover.hidden && !distancePopover.contains(event.target) && event.target !== distanceTrigger) {
    commitDistance();
  }
});

setDuration(0, 0, true);
clearDistance();
