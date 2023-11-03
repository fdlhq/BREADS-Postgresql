var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const saltRounds = 10;

module.exports = function (db) {
  router.get("/", function (req, res, next) {
    res.render("login", {
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo"),
    });
  });

  router.post("/", async function (req, res, next) {
    try {
      const { email, password } = req.body;

      const { rows: users } = await db.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      if (users.length == 0) {
        req.flash("failedInfo", `email doesn't exist`);
        return res.redirect("/");
      }

      if (!bcrypt.compareSync(password, users[0].password)) {
        req.flash("failedInfo", "password is wrong");
        return res.redirect("/");
      }

      req.session.user = { email: users[0].email, id: users[0].id };

      res.redirect("/users");
    } catch (e) {
      console.log(e);
      res.redirect("/");
    }
  });

  router.get("/register", function (req, res, next) {
    res.render("register", {
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo"),
    });
  });

  router.post("/register", async function (req, res, next) {
    try {
      const { email, password, repassword } = req.body;

      if (password !== repassword) {
        req.flash("failedInfo", `password doesn't match`);
        return res.redirect("/register");
      }

      const { rows: emails } = await db.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      if (emails.length > 0) {
        req.flash("failedInfo", "email already exist");
        return res.redirect("/register");
      }

      const hash = bcrypt.hashSync(password, saltRounds);

      await db.query("INSERT INTO users(email, password) VALUES ($1, $2)", [
        email,
        hash,
      ]);

      req.flash("successInfo", "successfully registered, please sign in!");

      res.redirect("/");
    } catch (e) {
      console.log(e);
      res.redirect("/");
    }
  });

  router.get("/logout", function (req, res) {
    req.session.destroy(function (err) {
      res.redirect("/");
    });
  });

  router.get("/logout", function (req, res) {
    req.session.destroy(function (err) {
      res.redirect("/");
    });
  });

  return router;
};
