document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".contact-form");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // stop page reload

    // Get field values
    const fullName = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    // Simple validation check
    if (fullName === "" || email === "" || message === "") {
      alert("Please fill in all fields before submitting.");
      return;
    }

    // If all fields are filled
    alert("Message Successfully Submitted");

    // OPTIONAL: clear the form after submission
    form.reset();
  });
});