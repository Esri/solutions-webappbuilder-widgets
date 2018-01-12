///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/dom-class',
  'dojo/dom-construct',
  'esri/geometry/webMercatorUtils',
  "esri/request"
], function(
  declare,
  lang,
  domClass,
  domConstruct,
  webMercatorUtils,
  esriRequest
) {

  var weatherInfo = declare('WeatherInfo', null, {

    constructor: function(tab, container, parent) {
      this.tab = tab;
      this.container = container;
      this.parent = parent;
      this.weatherURL = tab.url;
      this.weatherDict = {
        119: ["Cloudy", "cloudy5.png", "cloudy5.png"],
        377: ["Moderate or heavy showers of ice pellets", "hail.png", "hail.png"],
        374: ["Light showers of ice pellets", "hail.png", "hail.png"],
        350: ["Ice pellets", "hail.png", "hail.png"],
        353: ["Light rain shower", "light_rain.png", "light_rain.png"],
        302: ["Moderate rain", "light_rain.png", "light_rain.png"],
        296: ["Light rain", "light_rain.png", "light_rain.png"],
        293: ["Patchy light rain", "light_rain.png", "light_rain.png"],
        266: ["Light drizzle", "light_rain.png", "light_rain.png"],
        263: ["Patchy light drizzle", "light_rain.png", "light_rain.png"],
        122: ["Overcast", "overcast.png", "overcast.png"],
        359: ["Torrential rain shower", "shower3.png", "shower3.png"],
        308: ["Heavy rain", "shower3.png", "shower3.png"],
        365: ["Moderate or heavy sleet showers", "sleet.png", "sleet.png"],
        362: ["Light sleet showers", "sleet.png", "sleet.png"],
        320: ["Moderate or heavy sleet", "sleet.png", "sleet.png"],
        317: ["Light sleet", "sleet.png", "sleet.png"],
        314: ["Moderate or Heavy freezing rain", "sleet.png", "sleet.png"],
        311: ["Light freezing rain", "sleet.png", "sleet.png"],
        284: ["Heavy freezing drizzle", "sleet.png", "sleet.png"],
        281: ["Freezing drizzle", "sleet.png", "sleet.png"],
        185: ["Patchy freezing drizzle nearby", "sleet.png", "sleet.png"],
        182: ["Patchy sleet nearby", "sleet.png", "sleet.png"],
        395: ["Moderate or heavy snow in area with thunder", "snow4.png", "snow4.png"],
        335: ["Patchy heavy snow", "snow4.png", "snow4.png"],
        230: ["Blizzard", "snow4.png", "snow4.png"],
        227: ["Blowing snow", "snow4.png", "snow4.png"],
        371: ["Moderate or heavy snow showers", "snow5.png", "snow5.png"],
        338: ["Heavy snow", "snow5.png", "snow5.png"],
        389: ["Moderate or heavy rain in area with thunder", "tstorm3.png", "tstorm3.png"],
        392: ["Patchy light snow in area with thunder", "snow2.png", "snow2_night.png"],
        386: ["Patchy light rain in area with thunder", "tstorm1.png", "tstorm1_night.png"],
        368: ["Light snow showers", "snow2.png", "snow2_night.png"],
        356: ["Moderate or heavy rain shower", "shower2.png", "shower2_night.png"],
        332: ["Moderate snow", "snow3.png", "snow3_night.png"],
        329: ["Patchy moderate snow", "snow2.png", "snow2_night.png"],
        326: ["Light snow", "snow1.png", "snow1_night.png"],
        323: ["Patchy light snow", "snow1.png", "snow1_night.png"],
        305: ["Heavy rain at times", "shower2.png", "shower2_night.png"],
        299: ["Moderate rain at times", "shower2.png", "shower2_night.png"],
        260: ["Freezing fog", "fog.png", "fog_night.png"],
        248: ["Fog", "fog.png", "fog_night.png"],
        200: ["Thundery outbreaks in nearby", "tstorm1.png", "tstorm1_night.png"],
        179: ["Patchy snow nearby", "snow1.png", "snow1_night.png"],
        176: ["Patchy rain nearby", "shower1.png", "shower1_night.png"],
        143: ["Mist", "mist.png", "mist_night.png"],
        116: ["Partly Cloudy", "cloudy3.png", "cloudy3_night.png"],
        113: ["Clear/Sunny", "sunny.png", "sunny_night.png"]
      };
    },

    /* jshint unused: true */
    queryTabCount: function (incidents, buffers, updateNode) {
      this.updateTabCount(this.parent.incidents.length, updateNode, false);
    },

    /* jshint unused: true */
    updateTabCount: function (count, updateNode) {
      count = this.parent.incidents.length;
      if (typeof (count) !== 'undefined' && count === 0) {
        if (!domClass.contains(updateNode, 'noFeatures')) {
          domClass.add(updateNode, 'noFeatures');
        }
      } else {
        if (domClass.contains(updateNode, 'noFeatures')) {
          domClass.remove(updateNode, 'noFeatures');
        }
      }
    },

    // update for Incident
    // now expects to get a point in WGS84
    updateForIncident: function (pt) {
      this.container.innerHTML = "";
      domClass.add(this.container, "loading");

      var coords = pt.y + "," + pt.x;
      var requestURL = "";
      if (this.tab.label !== "Weather") {
        requestURL = this.weatherURL;
        this.container.innerHTML = "<img style='height:100%;' src='" + this.weatherURL + "' />";
        return;
      } else {
        requestURL = this.weatherURL + "&q=" + coords;
      }
      var weatherDeferred = esriRequest({
        url: requestURL,
        callbackParamName: "callback"
      }, {
        useProxy: false
      });
      weatherDeferred.then(lang.hitch(this, function(response) {
        var info = this._resultsHandler(response);
        return info;
      }), lang.hitch(this, function(error) {
        var info = this._errorHandler(error);
        console.log(info);
      }));
    },

    // results handler
    _resultsHandler: function(response) {
      var data = response.data;
      console.log(data);
      var current = data.current_condition;
      var weather = data.weather;

      var timeInfo = 1;

      this.container.innerHTML = "";
      domClass.remove(this.container, "loading");

      var tpc = domConstruct.create("div", {
        style: "width:" + ((weather.length + 3) * 165) + "px;"
      }, this.container);
      domClass.add(tpc, "SAT_tabPanelContent");
      var unit = this.parent.config.celsius ? "C" :"F";
      var cur, code, temp, w, info;
      if (current.length > 0) {
        cur = current[0];

        // time info
        var obs = cur.localObsDateTime.split(" ");
        var ampm = obs[2];
        var hrArray = obs[1].split(":");
        var hr = parseInt(hrArray[0], 10);
        if (ampm === "AM") {
          if ((hr < 6) || (hr === 12)) {
            timeInfo = 2;
          }
        } else {
          if ((hr > 6) && (hr < 12)) {
            timeInfo = 2;
          }
        }

        // current
        temp = cur.temp_F;
        if (this.parent.config.celsius) {
          temp = cur.temp_C;
        }
        code = cur.weatherCode;
        w = this.weatherDict[parseInt(code, 10)];
        info = this.parent.nls.now + "<br/><img style='height:45px' src='" +
          this.parent.folderUrl + "images/w/" + w[timeInfo] + "' /><br/>" + temp + "&deg;" + unit;
        var div = domConstruct.create("div", {
          innerHTML: info
        }, tpc);
        domClass.add(div, "SATcolSmall");
        domClass.add(div, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');

        // wind
        var windSpeed = cur.windspeedMiles;
        var windSpeedUnits = " mph";
        if (this.parent.config.celsius) {
          windSpeed = cur.windspeedKmph;
          windSpeedUnits = " km/h";
        }
        var windDir = cur.winddir16Point;

        info = this.parent.nls.wind + "<br/><span style='font-size: 30px; line-height:47px'>" +
          windDir + "</span><br/>" + windSpeed + windSpeedUnits;
        var div2 = domConstruct.create("div", {
          innerHTML: info
        }, tpc);
        domClass.add(div2, "SATcolSmall");
        domClass.add(div2, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');
      }

      // forecast
      for (var i = 0; i < weather.length; i++) {
        cur = weather[i];
        var day = this._getDay(cur.date);
        var tempMax = cur.tempMaxF || cur.maxtempF;
        var tempMin = cur.tempMinF || cur.mintempF;
        if (this.parent.config.celsius) {
          tempMax = cur.tempMaxC || cur.maxtempC;
          tempMin = cur.tempMinC || cur.mintempC;
        }
        code = cur.weatherCode;
        w = this.weatherDict[parseInt(code, 10)];
        info = day + "<br/><img style='height:45px' src='" + this.parent.folderUrl + "images/w/" +
          w[timeInfo] + "' /><br/>" + tempMax + "&deg;" + unit + " | " + tempMin + "&deg;" + unit;
        var div3 = domConstruct.create("div", {
          innerHTML: info
        }, tpc);
        domClass.add(div3, "SATcolSmall");
        domClass.add(div3, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');
      }

      // credits
      var txt = '<br/><br/><br/><span style="font-size:11px;color:#6e6e6e">' + this.parent.nls.poweredBy + '<br/>' +
      '<a style="color:#6e6e6e;text-decoration:none" ' +
      'href="http://www.worldweatheronline.com/" title="Free Weather API" target="_blank">' +
      'World Weather Online' + '</a></span>';
      var divCredit  = domConstruct.create("div", {
        innerHTML: txt
      }, tpc);
      domClass.add(divCredit, "SATcolSmall");
      domClass.add(divCredit, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');
      domClass.add(divCredit, "SATcolLast");
    },

    // get day
    _getDay: function(dateString) {
      var array = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      var dtArray = dateString.split("-");
      var d = new Date(dtArray[0], dtArray[1] - 1, dtArray[2]);
      var day = array[d.getDay()];
      var dayStr = this.parent.nls[day];
      return dayStr;
    },

    // error handler
    _errorHandler: function(error) {
      console.log(error.message);
      var info = error.message;
      var div = domConstruct.create("div", {
        innerHTML: info
      }, this.container);
      domClass.add(div, "SATcolSmall");
      domClass.add(div, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');
    }
  });

  return weatherInfo;

});
