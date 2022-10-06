const urlModel = require("../models/urlModel");
const axios = require("axios");
const shortId = require("shortid");
const redis = require("redis");

const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
  11693,
  "redis-11693.c212.ap-south-1-1.ec2.cloud.redislabs.com",
  { no_ready_check: true } //optional
);

redisClient.auth("fgY1Wek4Oag9aUeXDklbSzXyPp1As9VC", function (err) {
  if (err) throw err;
});

redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});

//Connection setup for redis
const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const createUrl = async function (req, res) {
  try {
    let urlCreate = req.body;
    if (Object.keys(urlCreate).length == 0) {
      return res
        .status(400)
        .send({ status: false, msg: "Request body can not be empty" });
    }
    if (!urlCreate.longUrl) {
      return res
        .status(400)
        .send({ status: false, msg: "Please enter longUrl Key" });
    }
    let correctLink = false;
    await axios
      .get(urlCreate.longUrl)
      .then((res) => {
        correctLink = true;
      })
      .catch((error) => {
        correctLink = false;
      });

    if (correctLink == false) {
      return res
        .status(400)
        .send({ status: false, message: "Please Provide correct url!!" });
    }

    let urlCheck = await urlModel
      .findOne({ longUrl: urlCreate.longUrl })
      .select({ _id: 0, longUrl: 1, shortUrl: 1, urlCode: 1 });
    //Getting data from caching server
    let cacheProfileData = await GET_ASYNC(`${urlCreate.longUrl}`);
    if (cacheProfileData) {
      console.log("cache generated for this link");
      let data = JSON.parse(cacheProfileData);
      let obj = {
        shortUrl: data.shortUrl,
        longUrl: data.longUrl,
        urlCode: data.urlCode,
      };
      return res.status(400).send({
        status: false,
        msg: "shortUrl for this longUrl has already been generated response form caching server",
        data: obj,
      });
    }
    //The code between 60- 75 lines used to get data from caching server
    if (urlCheck) {
      return res.status(400).send({
        status: false,
        msg: "shortUrl for this longUrl has already been generated response from mongo db",
        data: urlCheck,
      });
    }

    let generateId = shortId.generate(urlCreate.longUrl);
    let shortUrl = `http://localhost:3000/${generateId}`;

    let obj = {};
    obj.longUrl = req.body.longUrl;
    obj.shortUrl = shortUrl;
    obj.urlCode = generateId;

    let saveUrl = await urlModel.create(obj);

    await SET_ASYNC(`${saveUrl.longUrl}`, JSON.stringify(saveUrl)); //key(longUrl) => value(saveUrl)

    let saveUrl2 = await urlModel
      .findOne({ _id: saveUrl._id })
      .select({ _id: 0, longUrl: 1, shortUrl: 1, urlCode: 1 });
    return res
      .status(201)
      .send({ status: true, message: "created successfully", data: saveUrl2 });
  } catch (err) {
    res.status(500).send({ status: false, msg: err.message });
  }
};

//second get api url
const getUrl = async function (req, res) {
  try {
    let shortId = req.params.urlCode;
    if (!shortId) {
      return res
        .status(400)
        .send({ status: false, msg: "Please enter valid urlCode" });
    }

    // cashing part implemented here in this code

    let cacheProfileData = await GET_ASYNC(`${shortId}`);
    if (cacheProfileData) {
      console.log("cache generated for this link");
      let data = JSON.parse(cacheProfileData);
      res.status(302).redirect(data.longUrl);
    } else {
      let getData = await urlModel.findOne({ urlCode: shortId });
      if (!getData) {
        return res.status(404).send({ status: false, msg: "no url found" });
      }
      await SET_ASYNC(`${getData.urlCode}`, JSON.stringify(getData));
      return res.status(302).redirect(getData.longUrl);

      // all caching part in this part
    }
  } catch (err) {
    return res.status(500).send({ status: false, msg: err.message });
  }
};

module.exports.createUrl = createUrl;
module.exports.getUrl = getUrl;
