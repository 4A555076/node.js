require('dotenv').config();

const express = require('express');

const app = express();

app.set('view engine', 'ejs');
//路由設定,routes
app.get("/",(req,res) => {
    res.render('main' , {name:'專題'});
});

app.use(express.static('node_modules/bootstrap/dist'));
app.use(express.static('public'));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`伺服器啟動: ${port}`);
});