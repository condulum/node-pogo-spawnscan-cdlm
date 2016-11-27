/* eslint-disable */

const templateSTR = `
<html>
  <head>
  </head>
  <body>
    <p> If the captcha widget has expired, click Submit Token to refresh. </p>
    <form id="form">
      <div 
        class="g-recaptcha"
        data-callback="captchaResponse"
        data-expired-callback="refresh"
        data-size="compact"
        data-sitekey="6LeeTScTAAAAADqvhqVMhPpr_vB9D364Ia-1dSgK"
      >
      </div>
      <input type="submit" value="Submit Token">
    </form>
  </body>
</html>
`

const {ipcRenderer} = require('electron');

window.onload = function() {

  document.body.parentElement.innerHTML = templateSTR; // replace the page with 
  
  // async-ly load the recaptcha api script
  const script = document.createElement("script");
  script.src = "https://www.google.com/recaptcha/api.js";
  script.type = "text/javascript";
  document.getElementsByTagName("head")[0].appendChild(script);
 
  // get the form, and prevent it from doing "form action"

  const form = document.getElementById("form");
  form.addEventListener('submit', function(e) {

    e.preventDefault();

    const token = grecaptcha.getResponse();

    if (token.length > 0) { // if-else on token length. 
      ipcRenderer.send('token', token); // sends token to Main Electron Process
    } else {
      ipcRenderer.sendToHost('refresh'); // refreshes the page
    }
  })
}