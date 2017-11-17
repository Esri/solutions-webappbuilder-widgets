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
  'dojo/_base/array',
  'dojo/dom-class',
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./templates/Review.html",
  'dojo/query',
  './FeatureList',
  'jimu/dijit/Message',
  'jimu/CSVUtils',
  'esri/toolbars/edit'
],
  function (declare,
    lang,
    array,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    query,
    FeatureList,
    Message,
    CSVUtils,
    Edit) {
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
      csvStore: null,
      editLayer: null,
      matchedLayer: null,
      unMatchedLayer: null,
      duplicateLayer: null,
      _editToolbar: null,

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initReviewRows();
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
        this._editToolbar = new Edit(this.map);
      },

      startup: function () {
        this._started = true;
        this._updateAltIndexes();
        this._initNavPages();
      },

      onShown: function () {

      },

      _initNavPages: function () {
        if (this.pageContainer) {

          if (this.matchedList.length > 0) {
            var matched = this._initFeatureList(this.matchedList, this.matchedLayer, 'MatchedFeatures',
              this.nls.review.reviewMatchedPageHint, false);
            this.pageContainer.addView(matched);
            this._matchedListView = this.pageContainer.getViewByTitle(matched.label);
          }

          if (this.unMatchedList.length > 0) {
            var unMatched = this._initFeatureList(this.unMatchedList, this.unMatchedLayer, 'UnMatchedFeatures',
              this.nls.review.reviewUnMatchedPageHint, false);
            this.pageContainer.addView(unMatched);
            this._unMatchedListView = this.pageContainer.getViewByTitle(unMatched.label);
          }

          if (this.duplicateList.length > 0) {
            var duplicateFeat = this._initFeatureList(this.duplicateList, this.duplicateLayer, 'DuplicateFeatures',
              this.nls.review.reviewDuplicatePageHint, true);
            this.pageContainer.addView(duplicateFeat);
            this._duplicateListView = this.pageContainer.getViewByTitle(duplicateFeat.label);
          }

          this.altNextIndex = this.matchedList.length > 0 ? this._matchedListView.index :
            this.unMatchedList.length > 0 ? this._unMatchedListView.index :
              this.duplicateList.length > 0 ? this._duplicateListView.index : this.altNextIndex;
        }

        this.pageContainer.selectView(this.index);
      },

      _initFeatureList: function (features, layer, label, hint, isDuplicate) {
        return new FeatureList({
          nls: this.nls,
          map: this.map,
          parent: this.parent,
          config: this.config,
          appConfig: this.appConfig,
          hint: hint,
          label: label,
          features: features,
          theme: this.theme,
          isDuplicate: isDuplicate,
          isDarkTheme: this.isDarkTheme,
          layer: layer,
          _editToolbar: this._editToolbar,
          csvStore: this.csvStore
        });
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
        var name;
        if (this.matchedList.length > 0) {
          name = this.csvStore.matchedFeatureLayer.id.replace('.csv', '');
          this._export(this.csvStore.matchedFeatureLayer, name + this.nls.review.matched);
        }
        if (this.unMatchedList.length > 0) {
          name = this.csvStore.unMatchedFeatureLayer.id.replace('.csv', '');
          this._export(this.csvStore.unMatchedFeatureLayer, name + this.nls.review.unMatched);
        }
        if (this.duplicateList.length > 0) {
          name = this.csvStore.duplicateFeatureLayer.id.replace('.csv', '');
          this._export(this.csvStore.duplicateFeatureLayer, name + this.nls.review.duplicate);
        }
      },

      _export: function (layer, name) {
        var data = [];
        array.forEach(layer.graphics, function (gra) {
          data.push(gra.attributes);
        });

        var options = {};
        //options.popupInfo = layerInfo.getPopupInfo();
        options.datas = data;
        options.fromClient = false;
        options.withGeometry = false;
        options.outFields = layer.fields;
        options.formatDate = true;
        options.formatCodedValue = true;
        options.formatNumber = false;

        CSVUtils.exportCSVFromFeatureLayer(name, layer, options);
      },

      _submit: function () {
        this._updateNode(this.submitButton, false);
        this._updateNode(this.progressNode, true);
        //submit to feature service
        var featureLayer = this.csvStore.matchedFeatureLayer;
        var oidField = this.csvStore.objectIdField;
        var flayer = this.editLayer;
        var features = [];
        array.forEach(featureLayer.graphics, function (feature) {
          if (feature.attributes.hasOwnProperty(oidField)) {
            delete feature.attributes[oidField];
          }
          if (feature.hasOwnProperty("_graphicsLayer")) {
            delete feature._graphicsLayer;
          }
          if (feature.hasOwnProperty("_layer")) {
            delete feature._layer;
          }
          features.push(feature);
        });
        flayer.applyEdits(features, null, null, lang.hitch(this, function (e) {
          console.log(e);
          this._updateNode(this.progressNode, false);
          this._navigateHome();
        }), lang.hitch(this, function (err) {
          console.log(err);
          new Message({
            message: this.nls.warningsAndErrors.saveError
          });
        }));
      },

      _navigateHome: function () {
        //TODO navigate HOME
        var homeView = this.pageContainer.getViewByTitle('Home');
        var startView = this.pageContainer.getViewByTitle('StartPage');
        startView._clearStore();
        this.pageContainer.toggleController(true);
        this.pageContainer.selectView(homeView.index);
      },

      _updateNode: function (node, complete) {
        //toggle complete checkmark or add to map button
        if (complete) {
          if (domClass.contains(node, 'display-none')) {
            domClass.remove(node, 'display-none');
          }
        } else {
          if (!domClass.contains(node, 'display-none')) {
            domClass.add(node, 'display-none');
          }
        }
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