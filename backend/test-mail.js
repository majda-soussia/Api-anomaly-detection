const nodemailer = require("nodemailer");

async function test() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "soussiamajda@gmail.com",
      pass: "oipc bjqp msdv ddlr",
    },
  });

  try {
    await transporter.verify();
    console.log("Connexion SMTP réussie !");
  } catch (err) {
    console.error(err);
  }
}

test();