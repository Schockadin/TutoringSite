(function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');

  navToggle.addEventListener('click', function () {
    var isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  mainNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  var form = document.getElementById('contactForm');
  var formNote = document.getElementById('formNote');
  var CONTACT_EMAIL = 'deine-email@beispiel.de';

  function setError(fieldName, message) {
    var errorEl = form.querySelector('[data-error-for="' + fieldName + '"]');
    var inputEl = document.getElementById(fieldName);
    if (errorEl) errorEl.textContent = message || '';
    if (inputEl) inputEl.classList.toggle('invalid', Boolean(message));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();
    var subject = form.subject.value;
    var message = form.message.value.trim();

    var valid = true;

    if (!name) {
      setError('name', 'Bitte gib deinen Namen ein.');
      valid = false;
    } else {
      setError('name', '');
    }

    if (!email) {
      setError('email', 'Bitte gib deine E-Mail-Adresse ein.');
      valid = false;
    } else if (!isValidEmail(email)) {
      setError('email', 'Bitte gib eine gültige E-Mail-Adresse ein.');
      valid = false;
    } else {
      setError('email', '');
    }

    if (!message) {
      setError('message', 'Bitte gib eine Nachricht ein.');
      valid = false;
    } else {
      setError('message', '');
    }

    if (!valid) {
      formNote.textContent = 'Bitte überprüfe deine Eingaben.';
      formNote.className = 'form-note error';
      return;
    }

    var bodyLines = [
      'Name: ' + name,
      'E-Mail: ' + email,
      phone ? 'Telefon: ' + phone : null,
      'Fach: ' + subject,
      '',
      message
    ].filter(Boolean);

    var mailtoLink =
      'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent('Nachhilfe-Anfrage: ' + subject) +
      '&body=' + encodeURIComponent(bodyLines.join('\n'));

    window.location.href = mailtoLink;

    formNote.textContent = 'Dein E-Mail-Programm öffnet sich gleich mit deiner Nachricht. Falls nicht, schreib mir gerne direkt an ' + CONTACT_EMAIL + '.';
    formNote.className = 'form-note success';
  });
})();
