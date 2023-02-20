const express = require('express');
const db = require('../modules/connect-mysql');
const upload = require('../modules/upload-img');
const moment = require('moment-timezone');

const router = express.Router();

//針對此模組的頂層 ; 經過路由前，會先經過此middleware
//url, baseUrl, originalUrl 要在這裡拿，若在index那裡拿，originalUrl會一樣，但url & baseUrl會不同 
router.use((req,res,next)=>{
    const {url,baseUrl,originalUrl} = req;

    res.locals = {...res.locals,url,baseUrl,originalUrl};
    //不能使用-> res.locals.url = url (會將先前在index設定的middleware排除)
    if(! req.session.user){  //如果沒有登入會員,就看不到新增會員表單
        req.session.lastPage = req.originalUrl;  
        return res.redirect('/login');
    }

    next();
});
db.activitypettype.hasMany(db.activity,{
    foreignKey:'activity_pettype',
    as:'activity'
})
db.activity.belongsTo(db.activitypettype,{
    foreignKey:'activity_pettype',
    as:'activitypettype'
})

const getListData = async(req,res)=>{

    let page = +req.query.page || 1;   //用戶要看第幾頁

    if(page<1){
        return res.redirect(req.baseUrl+req.url);
    }

    //關鍵字搜尋
    let where = ' WHERE 1 ';
    let search = req.query.search || '';
    let orderby = req.query.orderby || '';


    if(search){
        const esc_search = db.escape(`%${search}%`);  //sql跳脫單引號
        console.log({esc_search});
        where += `AND \`activity_name\` LIKE ${esc_search} `;
    }

    let orderbySQL = 'ORDER BY activity_id ASC'; //預設值(編號升冪)
  switch(orderby){
    case 'activity_id_desc':
      orderbySQL = 'ORDER BY activity_id DESC';
      break;
    case 'activity_datestart_asc':
      orderbySQL = 'ORDER BY activity_datestart ASC';
      break;
    case 'activity_datestart_desc':
      orderbySQL = 'ORDER BY activity_datestart DESC';
      break;
    case 'activity_dateend_asc':
      orderbySQL = 'ORDER BY activity_dateend ASC';
      break;
    case 'activity_dateend_desc':
      orderbySQL = 'ORDER BY activity_dateend DESC';
      break;

  }


    const perPage = 5;
    const t_sql = `SELECT COUNT(1) totalRows FROM activity ${where}`;
    const [[{totalRows}]] = await db.query(t_sql);

    const totalPages = Math.ceil(totalRows/perPage);

    let rows = [];
    if(totalRows>0){
        if(page>totalPages){
            return res.redirect("?page="+totalPages);  //頁面轉向到最後一頁
        }
        // const sql = `SELECT * FROM activity ${where} ${orderbySQL} LIMIT ${(page-1)*perPage},${perPage}`;
        const sql = `SELECT activitypettype.* , activity.* FROM  activity JOIN activitypettype ON activity.activity_pettype=activitypettype.activity_pettype ${where} ${orderbySQL} LIMIT ${(page-1)*perPage},${perPage}`;
        // SELECT activitypettype.* , activity.* FROM `activity` JOIN `activitypettype` ON activity.activity_pettype=activitypettype.activity_pettype WHERE activity_id=1;
        [rows] = await db.query(sql);
    }

    return {totalRows,totalPages,page,rows};
}


router.get("/add",async(req,res)=>{
    res.render("activity-add");
});

router.post("/add",upload.none(),async(req,res)=>{

    const output = {
        success:false,
        postData:req.body,
        code:0,
        errors:{},
    };

    let {activity_name,activity_datestart, activity_dateend,activity_pettype,activity_location,activity_decription, activity_notice} = req.body;

    if(!activity_name || activity_name.length<1){
        output.errors.activity_name = '請輸入正確的活動名稱';
        return res.json(output);
    }

    const sql = "INSERT INTO `activity`(`activity_name`,`activity_datestart`, `activity_dateend`,`activity_pettype`,`activity_location`,`activity_decription`, `activity_notice`) VALUES (?, ?, ?, ?, ?, ?, ?)";

    const [result] = await db.query(sql,[activity_name,activity_datestart, activity_dateend,activity_pettype,activity_location,activity_decription, activity_notice])

    output.result = result;
    output.success = !! result.affectedRows;
    res.json(output);
});


router.get("/edit/:activity_id",async(req,res)=>{

    const activity_id = +req.params.activity_id ||0;
    if(!activity_id){
        return res.redirect(req.baseUrl); //轉向到列表頁
    }

    const sql = "SELECT * FROM activity WHERE activity_id=?";
    const [rows] = await db.query(sql,[activity_id]);
    if(rows.length<1){
        return res.redirect(req.baseUrl); //轉向到列表頁
    }
    const row = rows[0];
    // res.json(row);

    //從哪裡來
    const referer = req.get('Referer') || req.baseUrl;
    
    res.render("activity-edit",{...row,referer});
});

router.put("/edit/:activity_id",upload.none(),async(req,res)=>{
    // return res.json(req.body);

    const output = {
        success:false,
        postData:req.body,
        code:0,
        errors:{},
    };

    const activity_id = +req.params.activity_id ||0;
    if(!activity_id){
        output.error.activity_id = '沒有資料編號';
        return res.json(output);  //API不要用轉向
    }

    const {activity_name,activity_datestart,activity_dateend,activity_pettype,activity_location,activity_decription,activity_notice} = req.body;

    if(!activity_name || activity_name.length<1){
        output.errors.activity_name = '請輸入正確的活動名稱';
        return res.json(output);
    }

     const sql = "UPDATE `activity` SET `activity_name`=?,`activity_datestart`=?,`activity_dateend`=?,`activity_pettype`=?,`activity_location`=?,`activity_decription`=?,`activity_notice`=? WHERE `activity_id`=?";

    // const sql = "UPDATE `activity` SET `activity_name`=?,`activity_datestart`=?,`activity_dateend`=?,`activity_pettype`=?,`activity_location`=?,`activity_decription`=?,`activity_notice`=? WHERE `activity_id`=?";

    const [result] = await db.query(sql,[activity_name,activity_datestart,activity_dateend,activity_pettype,activity_location,activity_decription,activity_notice,activity_id])

    output.result = result;
    output.success = !! result.changedRows;

    res.json(output);
});

router.get("/",async(req,res)=>{
    const output = await getListData(req,res);
    res.render('activity-list',output);
});

router.get("/api",async(req,res)=>{
    const output = await getListData(req,res);
    for(let item of output.rows){
        item.activity_date = res.locals.toDateString(item.activity_datestart); //修改activity_date格式
        item.activity_enddate = res.locals.toDatetimeString(item.activity_dateend); //修改activity_enddate格式
      }
    res.json(output);
});

router.delete("/:activity_id",async(req,res)=>{
    const output = {
        success:false,
        error:'',
    }

    const activity_id = +req.params.activity_id ||0;
    if(!activity_id){
        output.error = '沒有activity_id';
        return res.json(output);
    }
    const sql = "DELETE FROM `activity` WHERE activity_id=?";
    const [result] = await db.query(sql,[activity_id]);

    output.success = !! result.affectedRows;
    res.json(output);

});

module.exports=router;