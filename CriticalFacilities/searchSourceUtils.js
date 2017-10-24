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
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/Deferred',
  'dojo/when',
  'dojo/promise/all',
  'jimu/portalUtils',
  'esri/lang',
  'esri/request'
], function (
  lang,
  array,
  Deferred,
  when,
  all,
  portalUtils,
  esriLang,
  esriRequest
) {
  var mo = {
    map: null,
    layerInfosObj: null,
    appConfig: null,
    _esriLocatorRegExp: /geocode(.){0,3}\.arcgis.com\/arcgis\/rest\/services\/World\/GeocodeServer/g
  };

  mo.setMap = function (map) {
    this.map = map;
  };

  mo.setLayerInfosObj = function (layerObj) {
    this.layerInfosObj = layerObj;
  };

  mo.setAppConfig = function (apc) {
    this.appConfig = apc;
  };

  mo.getConfigInfo = function (config) {
    if (config && config.sources && config.sources.length > 0) {
      var searchInfo = null;
      if (this.searchLayer(this.map) && config.upgradeFromGeocoder) {
        // back compatibility for config which come from geo coders
        searchInfo = this.map.itemInfo.itemData.applicationProperties.viewing.search;
        var defs = array.map(searchInfo.layers, lang.hitch(this, function (hintText, _layer) {
          _layer.hintText = hintText;
          return this._getQueryTypeGeocoder(_layer);
        }, searchInfo.hintText));
        return all(defs).then(lang.hitch(this, function (results) {
          config.sources = [].concat(results).concat(config.sources);
          return config;
        }));
      } else {
        return config;
      }
    } else {
      return when(this._getSourcesFromPortalAndWebmap())
        .then(lang.hitch(this, function (sources) {
          return {
            "allPlaceholder": "",
            "showInfoWindowOnSelect": true,
            "sources": sources
          };
        }));
    }
  };

  mo._getSourcesFromPortalAndWebmap = function () {
    var defs = [];
    var searchInfo = null;
    if (this.searchLayer(this.map)) {
      searchInfo = this.map.itemInfo.itemData.applicationProperties.viewing.search;
      array.forEach(searchInfo.layers, lang.hitch(this, function (hintText, _layer) {
        _layer.hintText = hintText;
        defs.push(this._getQueryTypeGeocoder(_layer));
      }, searchInfo.hintText));
    } // else do nothing

    return portalUtils.getPortalSelfInfo(this.appConfig.portalUrl)
      .then(lang.hitch(this, function (response) {
        var geocoders = response.helperServices && response.helperServices.geocode;

        if (geocoders && geocoders.length > 0) {
          for (var i = 0, len = geocoders.length; i < len; i++) {
            var geocoder = geocoders[i];
            if (geocoder) {
              defs.push(this._processSingleLine(geocoder));
            }
          }
        }

        return all(defs).then(lang.hitch(this, function (results) {
          var validSources = [];
          for (var i = 0; i < results.length; i++) {
            var geocode = results[i];
            if (!geocode) {
              continue;
            } else if (geocode && geocode.type === 'query') {
              validSources.push(geocode);
            } else {
              var json = {
                name: geocode.name || this._getGeocodeName(geocode.url),
                url: geocode.url,
                singleLineFieldName: geocode.singleLineFieldName,
                placeholder: geocode.placeholder ||
                geocode.name || this._getGeocodeName(geocode.url),
                maxResults: 6,
                searchInCurrentMapExtent: false,
                type: "locator"
              };
              json.enableLocalSearch = this._isEsriLocator(json.url);
              json.localSearchMinScale = 300000;
              json.localSearchDistance = 50000;

              validSources.push(json);
            }
          }

          return validSources;
        }));
      }));
  };

  mo._getQueryTypeGeocoder = function (item) {
    var layer = this.map.getLayer(item.id);
    var url = null;
    var _layerInfo = null;
    var _layerId = null;

    if (esriLang.isDefined(item.subLayer)) {
      _layerId = item.id + "_" + item.subLayer;
    } else {
      _layerId = item.id;
    }

    var isInMap = this.layerInfosObj.traversal(function (layerInfo) {
      if (layerInfo.id === _layerId) {
        _layerInfo = layerInfo;
        return true;
      }

      return false;
    });

    if (layer && isInMap && _layerInfo) {
      if (esriLang.isDefined(item.subLayer)) {
        url = _layerInfo.url || (layer.url + "/" + item.subLayer);
      } else {
        url = _layerInfo.url || layer.url;
      }

      return {
        name: _layerInfo.title,
        layerId: _layerId,
        url: url,
        placeholder: item.hintText,
        searchFields: [item.field.name],
        displayField: item.field.name,
        exactMatch: item.field.exactMatch || false,
        maxResults: 6,
        searchInCurrentMapExtent: false,
        type: "query"
      };
    } else {
      return null;
    }
  };

  mo._isEsriLocator = function (url) {
    this._esriLocatorRegExp.lastIndex = 0;
    return this._esriLocatorRegExp.test(url);
  };

  mo._processSingleLine = function (geocode) {
    // this._esriLocatorRegExp.lastIndex = 0;
    if (geocode.singleLineFieldName) {
      return geocode;
    } else if (this._isEsriLocator(geocode.url)) {
      geocode.singleLineFieldName = 'SingleLine';
      return geocode;
    } else {
      var def = new Deferred();
      esriRequest({
        url: geocode.url,
        content: {
          f: "json"
        },
        handleAs: "json",
        callbackParamName: "callback"
      }).then(lang.hitch(this, function (response) {
        if (response.singleLineAddressField && response.singleLineAddressField.name) {
          geocode.singleLineFieldName = response.singleLineAddressField.name;
          def.resolve(geocode);
        } else {
          console.warn(geocode.url + "has no singleLineFieldName");
          def.resolve(null);
        }
      }), lang.hitch(this, function (err) {
        console.error(err);
        def.resolve(null);
      }));

      return def.promise;
    }
  };

  mo._getGeocodeName = function (geocodeUrl) {
    if (typeof geocodeUrl !== "string") {
      return "geocoder";
    }
    var urlString = geocodeUrl.split('/');
    return urlString[urlString.length - 2] || "geocoder";
  };

  mo.getGeocoderName = function (url) {
    return this._getGeocodeName(url);
  };

  mo.hasAppSearchInfo = function (map) {
    return map.itemInfo && map.itemInfo.itemData &&
      map.itemInfo.itemData.applicationProperties &&
      map.itemInfo.itemData.applicationProperties.viewing &&
      map.itemInfo.itemData.applicationProperties.viewing.search;
  };

  mo.searchLayer = function (map) {
    if (!this.hasAppSearchInfo(map)) {
      return false;
    }
    var search = map.itemInfo.itemData.applicationProperties.viewing.search;
    if (!search.enabled) {
      return false;
    }
    if (search.layers.length === 0) {
      return false;
    }

    return true;
  };

  return mo;
});