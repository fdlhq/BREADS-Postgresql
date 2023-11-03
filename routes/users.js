var express = require("express");
var router = express.Router();
const moment = require("moment");
const { isLoggedIn } = require("../helpers/util");
const path = require("path");

module.exports = function (db) {
  router.get("/", isLoggedIn, (req, res) => {
    const {
      page = 1,
      title,
      startdate,
      enddate,
      complete,
      mode,
      sort = "desc",
      sortby = "id",
    } = req.query;

    const limit = 5;
    const offset = (page - 1) * 5;

    const queries = [];
    const params = [];
    const paramscount = [];
    params.push(req.session.user.id);
    paramscount.push(req.session.user.id);

    if (title) {
      params.push(title);
      paramscount.push(title);
      queries.push(`title ILIKE '%' || $${params.length} || '%'`);
    }

    if (startdate && enddate) {
      params.push(startdate, enddate);
      paramscount.push(startdate, enddate);
      queries.push(
        `deadline between $${params.length - 1} and $${
          params.length
        }::TIMESTAMP + INTERVAL '1 DAY - 1 SECOND'`
      );
    } else if (startdate) {
      params.push(startdate);
      paramscount.push(startdate);
      queries.push(`deadline >= $${params.length}`);
    } else if (enddate) {
      params.push(enddate);
      paramscount.push(enddate);
      queries.push(
        `deadline <= $${params.length}::TIMESTAMP + INTERVAL '1 DAY - 1 SECOND'`
      );
    }

    if (complete) {
      params.push(JSON.parse(complete));
      paramscount.push(complete);
      queries.push(`complete = $${params.length}`);
    }

    let sql = "SELECT * FROM todos WHERE userid = $1";
    let sqlcount = "SELECT COUNT(*) AS total FROM todos WHERE userid = $1";
    if (queries.length > 0) {
      sql += ` AND (${queries.join(` ${mode} `)})`;
      sqlcount += ` AND (${queries.join(` ${mode} `)})`;
    }

    db.query(sql, params, (err, { rows }) => {
      const total = rows.length;
      const pages = Math.ceil(total / limit);
      const url =
        req.url == "/"
          ? `/?page=${page}&sortby=${sortby}&sort=${sort}`
          : req.url;
      // const url = req.url.includes(`page=${page}`)
      //   ? req.url
      //   : req.url + `?page=${page}`;

      sql += ` ORDER BY ${sortby} ${sort}`;
      params.push(limit, offset);
      sql += ` limit $${params.length - 1} offset $${params.length}`;

      db.query(
        "SELECT * FROM users WHERE id = $1",
        [req.session.user.id],
        (err, { rows: profile }) => {
          if (err) return res.send(err);
          db.query(sql, params, (err, { rows }) => {
            if (err) return res.send(err);
            res.render("users/list", {
              data: rows,
              query: req.query,
              pages,
              page,
              offset,
              url,
              moment,
              user: req.session.user,
              preAvatar: profile[0].avatar,
              sort,
              sortby,
            });
          });
        }
      );
    });
  });

  router.get("/add", (req, res) => {
    res.render("users/add", { item: {}, moment });
  });

  router.post("/add", isLoggedIn, (req, res) => {
    db.query(
      "INSERT INTO todos(title, userid) VALUES ($1, $2)",
      [req.body.title, req.session.user.id],
      (err) => {
        if (err) return res.send(err);
        res.redirect("/users");
      }
    );
  });

  router.get("/delete/:index", (req, res) => {
    db.query("DELETE FROM todos WHERE id = $1", [req.params.index], (err) => {
      if (err) return res.send(err);
      res.redirect("/users");
    });
  });

  router.get("/edit/:id", (req, res) => {
    const id = req.params.id;
    db.query(
      `SELECT * FROM todos WHERE id = $1`,
      [id],
      (err, { rows: item }) => {
        if (err) return res.send(err);
        res.render("users/edit", { item, moment });
      }
    );
  });

  router.post("/edit/:index", (req, res) => {
    db.query(
      "UPDATE todos SET title = $1, deadline = $2, complete = $3 WHERE id = $4",
      [
        req.body.title,
        req.body.deadline,
        req.body.complete ? req.body.complete : false,
        req.params.index,
      ],
      (err) => {
        if (err) {
          console.log(err);
          return res.send(err);
        }
        res.redirect("/users");
      }
    );
  });

  router.get("/upload", isLoggedIn, async (req, res) => {
    db.query(
      `SELECT * FROM users WHERE id = $1`,
      [req.session.user.id],
      (err, { rows: item }) => {
        if (err) return res.send(err);
        res.render("users/upload", { preAvatar: item[0].avatar });
      }
    );
  });

  router.post("/upload", isLoggedIn, function (req, res) {
    let avatar;
    let uploadPath;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    avatar = req.files.avatar;
    let fileName = Date.now() + "-" + avatar.name;
    uploadPath = path.join(__dirname, "..", "public", "images", fileName);

    avatar.mv(uploadPath, async function (err) {
      if (err) return res.status(500).send(err);

      console.log(req.session.user);
      db.query(
        "UPDATE public.users SET avatar = $1 WHERE id = $2",
        [fileName, req.session.user.id],
        (err, { rows: item }) => {
          if (err) return res.send(err);
          res.redirect("/users");
        }
      );
    });
  });

  return router;
};
