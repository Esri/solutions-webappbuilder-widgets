///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
/**
 *  @fileOverview The GridOverlay widget
 *  @author Esri
 *
 * @todo Add and cleanup the code comments (including JSDoc comments)
 * @todo      Revisit all getters/setters for all configurable parameters
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",

    "./mgrs-utils",
    "./constants",

    "esri/layers/GraphicsLayer",
    "esri/graphic",
    "esri/Color",
    "esri/symbols/Font",
    "esri/symbols/TextSymbol",
    "esri/geometry/webMercatorUtils",

    "xstyle/css!./GridOverlay.css"
], function(
    declare, lang, array,
    gridUtils, constants,
    GraphicsLayer, Graphic, Color, Font, TextSymbol, webMercatorUtils
) {
    // If Math.log10 is not supported by default in the browser, add it here
    if (!Math.log10) {
        Math.log10 = function log10(val) {
            return Math.log(val) / Math.LN10;
        };
    }

    return declare(null, {
        minIntervalSpacing: 150,
        currentInterval: 0,
        levelOfDetail: "default",
        labelPlacement: null,
        verticalLabels: true,
        cornerLabelXOffset: 10,
        cornerLabelYOffset: 10,
        intervalLabelXOffset: 30,
        intervalLabelYOffset: 30,
        colors: null,
        lineWidths: null,
        fontSizes: null,
        lineOpacity: 0.8,
        labelOpacity: 1,
        centerLabelOpacity: 0.4,
        centerLabelScaleFactor: 3,
        fontFamily: "Arial, Helvetica, sans-serif",
        map: null,
        _lineGraphics: null,
        _labelGraphics: null,
        constructor: function(args) {
          // Grid constructor
          // @param  {object} args An object with the following properties:
          //                           map (required)         A reference to an esri map object
          //                           minSpacing (optional)  Min grid spacing in pixels
          //                           lineWidths (optional)  Array of line widths
          //                           colors (optional)      Array of colors
          //                           fontSizes (optional)   Array of font sizes
          //                           fontFamily (optional)  CSS type string of font family

          args = args || {};
          if (!args.map) {
            console.warn("Before the grid will draw, you must use the 'setMap' method to define which map object to draw on");
          }
          if (args.hasOwnProperty('enabled')) {
            this.enabled = args.enabled;
          } else {
            this.enabled = true;
          }
          this._lineGraphicsLayer = new GraphicsLayer();
          this._labelGraphicsLayer = new GraphicsLayer({"className": "gridOverlay"});
          this._centerLabelGraphicsLayer = new GraphicsLayer({"className": "gridOverlay"});

          // Set instance methods
          this.enable = lang.hitch(this, this.enable);
          this.disable = lang.hitch(this, this.disable);
          this.clearGrid = lang.hitch(this, this.clearGrid);
          this.drawGrid = lang.hitch(this, this.drawGrid);
          this.getLayers = lang.hitch(this, function() {
            return [
              this._lineGraphicsLayer,
              this._labelGraphicsLayer,
              this._centerLabelGraphicsLayer
            ];
          });

          // Set instance properties
          this.labelPlacement =
          {
              lowerLeft: true,
              lowerRight: true,
              upperLeft: true,
              upperRight: true,
              center: true
          };
          this.colors = ["#FA5858", "#F7FE2E", "#2EFE2E", "#2EFEF7", "#FFF", "#BDBDBD", "#000"];
          this.lineWidths = [3, 2, 1, 1, 1, 1, 1];
          this.fontSizes = [29, 27, 19, 16, 15, 13, 11];
          this.map = args.map || {};
          this._lineGraphics = [];
          this._labelGraphics = [];
          this._lineGraphicsLayer.setOpacity(this.lineOpacity);
          this._labelGraphicsLayer.setOpacity(this.labelOpacity);
          this._centerLabelGraphicsLayer.setOpacity(this.centerLabelOpacity);
          for (var i=0; i < this.colors.length; i++) {
            this.colors[i] = new Color(this.colors[i]);
          }
          this.setProperties(args);
        },

        // Setters and Getters of instance properties
        setProperties: function(args) {
            // Set user specified property overrides
            if (args.lineWidths) {
              this.setLineWidths(args.lineWidths);
            }
            if (args.minIntervalSpacing) {
              this.setMinIntervalSpacing(args.minIntervalSpacing);
            }
            if (args.levelOfDetail) {
              this.setLevelOfDetail(args.levelOfDetail);
            }
            if (args.labelPlacement) {
              this.setLabelPlacement(args.labelPlacement);
            }
            if (args.hasOwnProperty("verticalLabels")) {
              this.setVerticalLabels(args.verticalLabels);
            }
            if (args.cornerLabelXOffset) {
              this.setCornerLabelXOffset(args.cornerLabelXOffset);
            }
            if (args.cornerLabelYOffset) {
              this.setCornerLabelYOffset(args.cornerLabelYOffset);
            }
            if (args.intervalLabelXOffset) {
              this.setIntervalLabelXOffset(args.intervalLabelXOffset);
            }
            if (args.intervalLabelYOffset) {
              this.setIntervalLabelYOffset(args.intervalLabelYOffset);
            }
            if (args.colors) {
              this.setColors(args.colors);
            }
            if (args.lineWidths) {
              this.setLineWidths(args.lineWidths);
            }
            if (args.fontSizes) {
              this.setFontSizes(args.fontSizes);
            }
            if (args.lineOpacity) {
              this.setLineOpacity(args.lineOpacity);
            }
            if (args.labelOpacity) {
              this.setLabelOpacity(args.labelOpacity);
            }
            if (args.centerLabelOpacity) {
              this.setCenterLabelOpacity(args.centerLabelOpacity);
            }
            if (args.centerLabelScaleFactor) {
              this.setCenterLabelScaleFactor(args.centerLabelScaleFactor);
            }
            if (args.fontFamily) {
              this.setFontFamily(args.fontFamily);
            }
            if (this.enabled && this.map.loaded) {
              this.enable();
            }
            else if (this.enabled && this.map.on) {
              this.map.on('load', lang.hitch(this, this.enable));
            }
        },
        getMinIntervalSpacing: function() {
            return this.minIntervalSpacing;
        },
        setMinIntervalSpacing: function(value) {
            if (typeof value == "number") {this.minIntervalSpacing = value; this.drawGrid();}
        },
        setLevelOfDetail: function(value) {
          if (typeof value != "string") {return null;}
          value = value.toLowerCase();
          switch (value) {
            case "more": case "best": case "high": case "maximum": case "max":
                this.levelOfDetail = "more";
                break;
            case "less": case "low": case "minimum": case "mim":
                this.levelOfDetail = "less";
                break;
            default:
                this.levelOfDetail = "default";
          }
          this.drawGrid();
        },
        getLevelOfDetail: function() {
            return this.levelOfDetail;
        },
        getLabelPlacement: function() {
            return this.labelPlacement;
        },
        setLabelPlacement: function(value, value2) {
            if (typeof value == "object" && value.length) {
                this.labelPlacement = {
                    lowerLeft: false,
                    lowerRight: false,
                    upperLeft: false,
                    upperRight: false,
                    center: false
                };
                for (var i=0; i<value.length; i++) {
                  this.setLabelPlacement(value[i], true);
                }
                return;
            }
            if (typeof value == "object") {
                this.labelPlacement = value;
                return;
            }
            if (typeof value2 == "undefined") {
                this.labelPlacement = {
                    lowerLeft: false,
                    lowerRight: false,
                    upperLeft: false,
                    upperRight: false,
                    center: false
                };
                value2 = true;
            } else {
                value2 = value2 === true;
            }
            if (!value.toLowerCase) {
              return;
            }
            switch (value.toLowerCase()) {
                case "center": case "middle":
                    this.labelPlacement.center = value2;
                    break;
                case "top": case "upper":
                    this.labelPlacement.upperLeft = value2;
                    this.labelPlacement.upperRight = value2;
                    break;
                case "bottom": case "lower":
                    this.labelPlacement.lowerLeft = value2;
                    this.labelPlacement.lowerRight = value2;
                    break;
                case "left":
                    this.labelPlacement.lowerLeft = value2;
                    this.labelPlacement.upperLeft = value2;
                    break;
                case "right":
                    this.labelPlacement.lowerRight = value2;
                    this.labelPlacement.upperRight = value2;
                    break;
                case "lower-left": case "bottom-left":
                    this.labelPlacement.lowerLeft = value2;
                    break;
                case "upper-left": case "top-left":
                    this.labelPlacement.upperLeft = value2;
                    break;
                case "lower-right": case "bottom-right":
                    this.labelPlacement.lowerRight = value2;
                    break;
                case "upper-right": case "top-right":
                    this.labelPlacement.upperRight = value2;
                    break;
                case "all":
                    this.labelPlacement.lowerLeft = value2;
                    this.labelPlacement.lowerRight = value2;
                    this.labelPlacement.upperLeft = value2;
                    this.labelPlacement.upperRight = value2;
                    this.labelPlacement.center = value2;
                    break;
                default:
                    this.labelPlacement.lowerLeft = value2;
                    this.labelPlacement.lowerRight = value2;
                    this.labelPlacement.upperLeft = value2;
                    this.labelPlacement.upperRight = value2;
            }
            this.drawGrid();
        },
        getVerticalLabels: function() {
          return this.verticalLabels;
        },
        setVerticalLabels: function(value) {
          if (typeof value == "boolean") {
            this.verticalLabels = value;
            this.drawGrid();
          }
        },
        getCornerLabelXOffset: function() {
            return this.cornerLabelXOffset;
        },
        setCornerLabelXOffset: function(value) {
            if (typeof value == "number") {
              this.cornerLabelXOffset = value;
              this.drawGrid();
            }
        },
        getCornerLabelYOffset: function() {
            return this.cornerLabelYOffset;
        },
        setCornerLabelYOffset: function(value) {
            if (typeof value == "number") {
              this.cornerLabelYOffset = value;
              this.drawGrid();
            }
        },
        getIntervalLabelXOffset: function() {
            return this.intervalLabelXOffset;
        },
        setIntervalLabelXOffset: function(value) {
            if (typeof value == "number") {
              this.intervalLabelXOffset = value;
              this.drawGrid();
            }
        },
        getIntervalLabelYOffset: function() {
            return this.intervalLabelYOffset;
        },
        setIntervalLabelYOffset: function(value) {
            if (typeof value == "number") {
              this.intervalLabelYOffset = value;
              this.drawGrid();
            }
        },
        getColor: function(index) {
            if (typeof index != "number" || index < 0 || index > this.colors.length - 1) {
              return null;
            }
            return this.colors[index];
        },
        setColor: function(index, color) {
            if (typeof index != "number" || index < 0 || index > this.colors.length - 1) {
              return null;
            }
            this.colors[index] = new Color(color);
            this.drawGrid();
        },
        setColors: function(colorArray) {
          if (typeof colorArray != "object" || !colorArray.length) {
            return null;
          }
          var colorArrayIndex;
          for (var i=0; i < this.colors.length; i++) {
              colorArrayIndex = colorArray.length > i ? i : colorArray.length - 1;
              this.colors[i] = new Color(colorArray[colorArrayIndex]);
          }
          this.drawGrid();
        },
        getLineWidth: function(index) {
          if (typeof index != "number" || index < 0 || index > this.lineWidths.length - 1) {
            return null;
          }
          return this.lineWidths[index];
        },
        setLineWidth: function(index, width) {
          if (typeof index != "number" || typeof width != "number" || index < 0 || index > this.lineWidths.length - 1) {
            return null;
          }
          this.lineWidths[index] = width;
          this.drawGrid();
        },
        setLineWidths: function(widthArray) {
          if (typeof widthArray != "object" || !widthArray.length) {
            return null;
          }
          var widthArrayIndex;
          for (var i=0; i < this.lineWidths.length; i++) {
              widthArrayIndex = widthArray.length > i ? i : widthArray.length - 1;
              if (typeof widthArray[widthArrayIndex] != "number") {
                continue;
              }
              this.lineWidths[i] = widthArray[widthArrayIndex];
          }
          this.drawGrid();
        },
        getFontSize: function(index) {
          if (typeof index != "number" || index < 0 || index > this.fontSizes.length - 1) {
            return null;
          }
          return this.fontSizes[index];
        },
        setFontSize: function(index, size) {
          if (typeof index != "number" || typeof size != "number" || index < 0 || index > this.fontSizes.length - 1) {
            return null;
          }
          this.fontSizes[index] = size;
          this.drawGrid();
        },
        setFontSizes: function(sizeArray) {
          if (typeof sizeArray != "object" || !sizeArray.length) {
            return null;
          }
          var sizeArrayIndex;
          for (var i=0; i < this.fontSizes.length; i++) {
              sizeArrayIndex = sizeArray.length > i ? i : sizeArray.length - 1;
              if (typeof sizeArray[sizeArrayIndex] != "number") {
                continue;
              }
              this.fontSizes[i] = sizeArray[sizeArrayIndex];
          }
          this.drawGrid();
        },
        getCenterLabelScaleFactor: function() {
            return this.centerLabelScaleFactor;
        },
        setCenterLabelScaleFactor: function(value) {
            if (typeof value == "number") {
              this.centerLabelScaleFactor = value;
              this.drawGrid();
            }
        },
        getCenterLabelOpacity: function() {
            return this.centerLabelOpacity;
        },
        setCenterLabelOpacity: function(value) {
            if (typeof value == "number") {
              this.centerLabelOpacity = value;
              this._centerLabelGraphicsLayer.setOpacity(value);
              this.drawGrid();
            }
        },
        getFontFamily: function() {
            return this.fontFamily;
        },
        setFontFamily: function(value) {
            if (typeof value == "string") {
              this.fontFamily = value;
              this.drawGrid();
            }
        },
        getInterval: function() {
            return this.currentInterval;
        },
        setInterval: function() {
          this.currentInterval = gridUtils.getInterval(this.getMinIntervalSpacing(), this.map, this.getLevelOfDetail());
        },
        getMap: function() {
          return this.map;
        },

        setMap: lang.hitch(this, function(newMap) {
          if (this.map.loaded) {
            this.clearGrid();
          }
          this.map = newMap;
          if (this.enabled && this.map.loaded) {
            this.enable();
          } else if (this.enabled) {
            this.map.on('load', lang.hitch(this, this.enable));
          }
        }),
        getLineOpacity: function() {
          return this.lineOpacity;
        },
        setLineOpacity: function(value) {
            if (typeof value == "number") {
              this.lineOpacity = value;
              this._lineGraphicsLayer.setOpacity(value);
            }
        },
        getLabelOpacity: function() {
          return this.labelOpacity;
        },
        setLabelOpacity: function(value) {
            if (typeof value == "number") {
              this.labelOpacity = value;
              this._labelGraphicsLayer.setOpacity(value);
            }
        },
        getSettings: function() {
            return {
                "minIntervalSpacing": this.minIntervalSpacing,
                "levelOfDetail": this.levelOfDetail,
                "labelPlacement": this.labelPlacement,
                "verticalLabels": this.verticalLabels,
                "cornerLabelXOffset": this.cornerLabelXOffset,
                "cornerLabelYOffset": this.cornerLabelYOffset,
                "intervalLabelXOffset": this.intervalLabelXOffset,
                "intervalLabelYOffset": this.intervalLabelYOffset,
                "colors": array.map(this.colors, function(itm) {return itm.toHex();}),
                "lineWidths": this.lineWidths,
                "fontSizes": this.fontSizes,
                "lineOpacity": this.lineOpacity,
                "labelOpacity": this.labelOpacity,
                "centerLabelOpacity": this.centerLabelOpacity,
                "centerLabelScaleFactor":this.centerLabelScaleFactor,
                "fontFamily": this.fontFamily
              };
        },

        enable: function() {
          var map = this.getMap();
          this.enabled = true;
          map.addLayers(this.getLayers());
          this._drawEvent = map.on('extent-change', lang.hitch(this, function() {this._drawGrid();}));
          this._drawGrid();
        },
        disable: function() {
          var map = this.getMap();
          this.enabled = false;
          if (this._drawEvent) {
            this._drawEvent.remove();
            this._drawEvent = null;
          }
          this.clearGrid();
          var layers = this.getLayers();
          for (var i=0; i < layers.length; i++) {
            map.removeLayer(layers[i]);
          }
        },
        clearGrid: function() {
          var map = this.getMap();
          if (!map.loaded) {
            var clearEvent = map.on('load', lang.hitch(this, function() {
              clearEvent.remove();
              this.clearGrid();
            }));
          }
          // clear all graphics & labels
          this._lineGraphicsLayer.clear();
          this._labelGraphicsLayer.clear();
          this._centerLabelGraphicsLayer.clear();
          this._lineGraphics = [];
          this._labelGraphics = [];
          this._centerLabelGraphics = [];
        },
        drawGrid: function() {
          if (!this._drawing) {
            return;
          }
          this._drawGrid();
        },
        _drawGrid: function() {
          var map = this.getMap();
          var i, zones;
          // clear all graphics & labels
          // this.clearGrid();
          if (this._drawing) {clearTimeout(this._drawing);}
          this._drawing = setTimeout(lang.hitch(this, function() {
            if (!map.loaded || !this.enabled) {
              return;
            }
            // determine which MGRS grid zones are displayed on screen
            zones = gridUtils.zonesFromExtent(this);
            // console.log(zones);
            this._zoneCount = zones.length; // needed to identity when only one zone is visible (for labelling purposes)
            // clear all graphics & labels
            this.clearGrid();
            // set the grid interval
            this.setInterval();

            // temporary arrays to hold graphics (managed separately to allow control of drawing order)
            // these are added as properties to 'this' in order to make it easier to pass them by reference
            this._lineGraphics = [];
            this._lineGraphics0 = [];
            this._lineGraphics1 = [];
            this._lineGraphics2 = [];
            this._lineGraphics3 = [];
            this._lineGraphics4 = [];
            this._lineGraphics5 = [];

            gridUtils.processZonePolygons(zones, this);
            // // process each grid zone separately
            // for (i = 0; i < zones.length; i++) {
            //   if (zones[i]) {
            //     gridUtils.processZonePolygon(zones[i], this);
            //   }
            // }
            for (i = 0; i < this._centerLabelGraphics.length; i++) {
              this._centerLabelGraphicsLayer.add(this._centerLabelGraphics[i]);
            }
            array.forEach([this._lineGraphics5, this._lineGraphics4, this._lineGraphics3, this._lineGraphics2, this._lineGraphics1, this._lineGraphics0], function(arr) {
              this._lineGraphics = this._lineGraphics.concat(arr);
            }, this);
            for (i = 0; i < this._lineGraphics.length; i++) {
              this._lineGraphics[i].geometry = webMercatorUtils.project(this._lineGraphics[i].geometry, this._lineGraphicsLayer.spatialReference);
              this._lineGraphicsLayer.add(this._lineGraphics[i]);
            }
            for (i = 0; i < this._labelGraphics.length; i++) {
              this._labelGraphics[i].geometry = webMercatorUtils.project(this._labelGraphics[i].geometry, this._lineGraphicsLayer.spatialReference);
              this._labelGraphicsLayer.add(this._labelGraphics[i]);
              var node = this._labelGraphics[i].getNode();
              if (node) {
                var color = this._labelGraphics[i].symbol.color;
                var outlineColor = (0.2126*color.r + 0.7152*color.g + 0.0722*color.b) > 128 ? "black" : "white";
                node.classList.add('text-symbol-halo-' + outlineColor);
              }
            }

            // delete the temporary arrays;
            delete this._lineGraphics;
            delete this._lineGraphics0;
            delete this._lineGraphics1;
            delete this._lineGraphics2;
            delete this._lineGraphics3;
            delete this._lineGraphics4;
            delete this._lineGraphics5;
            return;
          }), 50);
        }
    });
});

