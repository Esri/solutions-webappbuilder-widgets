///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
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

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/html',
  'dojo/_base/array',
  'dojo/dom-class',
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./Review.html",
  'dojo/query',
  './FeatureList',
  'jimu/dijit/Message',
],
  function (declare,
    lang,
    html,
    array,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    query,
    FeatureList,
    Message) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-review',
      declaredClass: 'CriticalFacilities.Review',
      templateString: template,
      _started: null,
      label: 'Review',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      matchedList: [],
      unMatchedList: [],
      duplicateList: [],
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      myCsvStore: null,
      editLayer: null,

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initReviewRows();
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        console.log('Review startup');
        this._started = true;
        this._updateAltIndexes();
        this._initNavPages();
      },

      onShown: function () {
        console.log('Review shown');
      },

      _initNavPages: function () {
        if (this.pageContainer) {
          //TODO may need to get view instances after all have been added if the indexes don't update as expected
          if (this.matchedList.length > 0) {

            //the features here should be derived from the list 
            var _fl = new FeatureList({
              nls: this.nls,
              map: this.map,
              parent: this,
              config: this.config,
              appConfig: this.appConfig,
              hint: this.nls.review.reviewMatchedPageHint,
              label: 'MatchedFeatures',
              features: this.matchedList,
              theme: this.theme,
              isDarkTheme: this.isDarkTheme
            });

            this.pageContainer.addView(_fl);
            this._matchedListView = this.pageContainer.getViewByTitle(_fl.label);

            this.altNextIndex = this._matchedListView.index;
          }

          if (this.unMatchedList.length > 0) {
            //the features here should be derived from the list 
            var fl = new FeatureList({
              nls: this.nls,
              map: this.map,
              parent: this,
              config: this.config,
              appConfig: this.appConfig,
              hint: this.nls.review.reviewUnMatchedPageHint,
              label: 'UnMatchedFeatures',
              features: this.unMatchedList,
              theme: this.theme,
              isDarkTheme: this.isDarkTheme
            });

            this.pageContainer.addView(fl);
            this._unMatchedListView = this.pageContainer.getViewByTitle(fl.label);
          }

          if (this.duplicateList.length > 0) {
            var duplicateFeat = new FeatureList({
              nls: this.nls,
              map: this.map,
              parent: this,
              config: this.config,
              appConfig: this.appConfig,
              hint: this.nls.review.reviewDuplicatePageHint,
              label: 'DuplicateFeatures',
              features: this.duplicateList,
              theme: this.theme,
              isDuplicate: true,
              isDarkTheme: this.isDarkTheme
            });

            this.pageContainer.addView(duplicateFeat);
            this._duplicateListView = this.pageContainer.getViewByTitle(duplicateFeat.label);
          }
        }

        this.pageContainer.selectView(this.index);
      },

      _updateAltIndexes: function () {
        if (this.pageContainer && !this._startPageView) {
          this._startPageView = this.pageContainer.getViewByTitle('StartPage');
          if (this._startPageView) {
            //TODO this will need a custom validate function 
            // Will need a message also that is specific to clearing the results...or if 
            // we could support modification of the set...if they only change attribute values
            this.altBackIndex = this._startPageView.index;
          }
        }
      },

      _initReviewRows: function () {
        this._initReviewRow(this.matchedList,
          [this.matchedHintRow, this.matchedControlRow], this.matchedCount);
        this._initReviewRow(this.unMatchedList,
          [this.unMatchedHintRow, this.unMatchedControlRow], this.unMatchedCount);
        this._initReviewRow(this.duplicateList,
          [this.duplicateHintRow, this.duplicateControlRow], this.duplicateCount);
      },

      _initReviewRow: function (features, controlRows, countNode) {
        if (features.length > 0) {
          array.forEach(controlRows, function (r) {
            if (domClass.contains(r, 'display-none')) {
              domClass.remove(r, 'display-none');
            }
          });
          countNode.innerHTML = features.length;
        } else {
          array.forEach(controlRows, function (r) {
            if (!domClass.contains(r, 'display-none')){
              domClass.add(r, 'display-none');
            }
          });
        }
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        var removeClass = isDark ? 'next-arrow-img' : 'next-arrow-img-white';
        var addClass = isDark ? 'next-arrow-img-white' : 'next-arrow-img';
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      _download: function () {
        //wire up csv Utils
        alert('download goes here');
      },

      _submit: function () {
        //submit to feature service
        alert('submit goes here');

        //code from old widget

        var featureLayer = this.myCsvStore.featureLayer;
        var oidField = this.myCsvStore.objectIdField;
        var flayer = this.editLayer;
        var features = [];
        array.forEach(featureLayer.graphics, function (feature) {
          if (feature.attributes.hasOwnProperty(oidField)) {
            delete feature.attributes[oidField];
          }
          if (feature.attributes.hasOwnProperty("_graphicsLayer")) {
            delete feature._graphicsLayer;
          }
          if (feature.attributes.hasOwnProperty("_layer")) {
            delete feature._layer;
          }
          features.push(feature);
        });
        flayer.applyEdits(features, null, null, function (e) {
          console.log(e);
        }, function (err) {
          console.log(err);
          new Message({
            message: this.nls.warningsAndErrors.saveError
          });
        });
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateTheme: function (theme) {
        this.theme = theme;
      },

      _reviewMatched: function () {
        this.pageContainer.selectView(this._matchedListView.index);
      },

      _reviewUnMatched: function () {
        this.pageContainer.selectView(this._unMatchedListView.index);
      },

      _reviewDuplicate: function () {
        this.pageContainer.selectView(this._duplicateListView.index);
      }
    });
  });