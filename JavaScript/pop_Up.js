document.addEventListener("DOMContentLoaded", () => {
  const message =
    "You cannot proceed further as this part is not done by Zehao. " +
    "Yi Hong done this part, and he has showcased it in the figma video. " +
    "The website is just to demonstrate how the AI Assistant will work for both answering queries and navigating the site for the user, " +
    "and also showcasing what Zehao has done for the prototype.";

  function showMessage(event) {
    event.preventDefault(); // stop navigation
    alert(message);
  }

  // 1️⃣ Learn More buttons (timeline cards)
  const learnMoreButtons = document.querySelectorAll(".event-btn");
  learnMoreButtons.forEach((btn) => {
    btn.addEventListener("click", showMessage);
  });

  // 2️⃣ Profile button in navbar
  const profileButton = document.querySelector(".nav-icon");
  if (profileButton) {
    profileButton.addEventListener("click", showMessage);
  }
});