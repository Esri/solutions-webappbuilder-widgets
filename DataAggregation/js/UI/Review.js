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
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/Deferred',
  'dojo/text!./templates/Review.html',
  'dojo/query',
  'dojo/on',
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
    Deferred,
    template,
    query,
    on,
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
      _syncFields: {},
      _currentIndex: 0,

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
        this._initNavPages();

        this._updateIndexesList();

        //for review the altNextIndex changes as we navigate through the various lists it may have
        this.altNextIndex = this.altNextIndexes[this._currentIndex];
        this._currentIndex = (this._currentIndex + 1 < this.altNextIndexes.length) ? this._currentIndex + 1 : 0;

        this.own(on(this.pageContainer, 'nav-view', lang.hitch(this, this._navView)));
      },

      onShown: function () {
        this.pageContainer.backDisabled = this.pageContainer._backLabels.length > 0 ? false : true;
      },

      _navView: function (idx) {
        if (idx === this.index) {
          this._updateIndexesList();
          if (this._currentIndex < this.altNextIndexes.length) {
            this.altNextIndex = this.altNextIndexes[this._currentIndex];
            this._currentIndex = (this._currentIndex + 1 < this.altNextIndexes.length) ? this._currentIndex + 1 : 0;
          } else {
            this._currentIndex = 0;
            this.altNextIndex = this.altNextIndexes[this._currentIndex];
          }
        }
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView());
        } else if (type === 'back-view') {
          def.resolve(this._backView(result));
        } else {
          this._homeView(result).then(function (v) {
            def.resolve(v);
          });
        }
        return def;
      },

      _nextView: function () {
        return true;
      },

      _backView: function (backResult) {
        return this.pageContainer._backLabels.length > 0 ? true : backResult.navView > this.index;
      },

      _homeView: function (backResult) {
        var def = new Deferred();
        var homeView = this.pageContainer.getViewByTitle('Home');
        homeView.verifyClearSettings(backResult).then(function (v) {
          def.resolve(v);
        });
        return def;
      },

      _updateIndexesList: function () {
        this.altNextIndexes = [];
        if (this.matchedList.length > 0) {
          this.altNextIndexes.push(this._matchedListView.index);
        }
        if (this.unMatchedList.length > 0){
          this.altNextIndexes.push(this._unMatchedListView.index);
        }
        if (this.duplicateList.length > 0) {
          this.altNextIndexes.push(this._duplicateListView.index);
        }
      },

      _initNavPages: function () {
        if (this.pageContainer) {
          //This will always be created but only shown when it has more than 0
          this._addMatchedFeaturesList();

          if (this.unMatchedList.length > 0) {
            this._addUnmatchedFeatureList();
          }

          if (this.duplicateList.length > 0) {
            this._addDuplicateFeatureList();
          }
        }

        this.pageContainer.selectView(this.index, true);
      },

      _addMatchedFeaturesList: function () {
        this.matchedFeatureList = this._initFeatureList(this.matchedList, this.matchedLayer,
          'MatchedFeatures', this.nls.review.reviewMatchedPageHint, false);
        this.pageContainer.addView(this.matchedFeatureList);
        this._updateNode(this.submitButton, this.matchedList.length > 0);
        this._matchedListView = this.pageContainer.getViewByTitle(this.matchedFeatureList.label);
        this.own(on(this.matchedFeatureList, 'feature-list-updated', lang.hitch(this, function (v) {
          this.matchedCount.innerHTML = v;
          this._initReviewRow(this.matchedList, [this.matchedHintRow, this.matchedControlRow], this.matchedCount);
          this._updateNode(this.submitButton, this.matchedList.length > 0);
        })));
      },

      _addUnmatchedFeatureList: function () {
        this.unMatchedFeatureList = this._initFeatureList(this.unMatchedList, this.unMatchedLayer,
          'UnMatchedFeatures', this.nls.review.reviewUnMatchedPageHint, false);
        this.pageContainer.addView(this.unMatchedFeatureList);
        this._unMatchedListView = this.pageContainer.getViewByTitle(this.unMatchedFeatureList.label);
        this.own(on(this.unMatchedFeatureList, 'feature-list-updated', lang.hitch(this, function (v) {
          this.unMatchedCount.innerHTML = v;
          if (v === 0) {
            this.pageContainer.removeView(this._unMatchedListView);
          }
        })));
      },

      _addDuplicateFeatureList: function () {
        this.duplicateFeatureList = this._initFeatureList(this.duplicateList, this.duplicateLayer,
          'DuplicateFeatures', this.nls.review.reviewDuplicatePageHint, true);
        this.pageContainer.addView(this.duplicateFeatureList);
        this._duplicateListView = this.pageContainer.getViewByTitle(this.duplicateFeatureList.label);
        this.own(on(this.duplicateFeatureList, 'feature-list-updated', lang.hitch(this, function (v) {
          this.duplicateCount.innerHTML = v;
          if (v === 0) {
            this.pageContainer.removeView(this._duplicateListView);
          }
        })));
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
          csvStore: this.csvStore,
          _syncFields: this._syncFields
        });
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

      _updateReviewRows: function (type) {
        this._initReviewRows();

        var list = (type === 'unmatched' && this.unMatchedFeatureList) ? this.unMatchedFeatureList :
          (type === 'duplicate' && this.duplicateFeatureList) ? this.duplicateFeatureList : undefined;
        if (list) {
          if (list.features && list.features.length === 0) {
            this.pageContainer.selectView(this.index, true);
          }
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
          this._export(this.csvStore.matchedFeatureLayer, name);
        }
        if (this.unMatchedList.length > 0) {
          name = this.csvStore.unMatchedFeatureLayer.id.replace('.csv', '');
          this._export(this.csvStore.unMatchedFeatureLayer, name);
        }
        if (this.duplicateList.length > 0) {
          name = this.csvStore.duplicateFeatureLayer.id.replace('.csv', '');
          this._export(this.csvStore.duplicateFeatureLayer, name);
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
        //submit to feature service
        //TODO understand if we are supposed to do anything to do this multi-part stayle for large number of features

        this._updateNode(this.submitButton, false);
        this._updateNode(this.progressNode, true);

        var addFeatures = this._getFeatures(this.csvStore.matchedFeatureLayer);
        var updateFeatures = this._getFeatures(this.csvStore.duplicateFeatureLayer);
        this.editLayer.applyEdits(addFeatures, updateFeatures, null, lang.hitch(this, function () {
          this._updateNode(this.progressNode, false);
          this._navigateHome();
          this.csvStore._zoomToData(this.editLayer.graphics, true);
        }), lang.hitch(this, function (err) {
          console.log(err);
          new Message({
            message: this.nls.warningsAndErrors.saveError
          });
        }));
      },

      _getFeatures: function (featureLayer) {
        //TODO the field names hard coded below should be derived from the csvStore
        // if they change in the csvStore they will need to change here
        var features = [];
        var oidField = this.csvStore.objectIdField;
        if (featureLayer && featureLayer.graphics) {
          array.forEach(featureLayer.graphics, lang.hitch(this, function (feature) {
            if (feature.hasOwnProperty("_graphicsLayer")) {
              delete feature._graphicsLayer;
            }
            if (feature.hasOwnProperty("_layer")) {
              delete feature._layer;
            }

            var attrs = feature.attributes;
            //if feature is duplicate and has updates push it for update...if it's not duplicate push it for add
            if (attrs.hasOwnProperty('hasDuplicateUpdates') && attrs.hasOwnProperty('duplicateState')) {
              if (attrs.hasDuplicateUpdates && attrs.duplicateState === 'make-change') {
                //update the OID...no updates will occur without this
                if (attrs.hasOwnProperty('DestinationOID')) {
                  attrs[this.editLayer.objectIdField] = attrs.DestinationOID;
                }
                this._deleteProp(attrs, 'hasDuplicateUpdates');
                this._deleteProp(attrs, 'duplicateState');
                features.push(feature);
              }
            } else {
              features.push(feature);
            }
            this._deleteProp(attrs, 'matchScore');
            this._deleteProp(attrs, oidField);
            this._deleteProp(attrs, 'DestinationOID');
          }));
        }
        return features.length > 0 ? features : null;
      },

      _deleteProp: function (attrs, fieldName) {
        if (attrs.hasOwnProperty(fieldName)) {
          delete attrs[fieldName];
        }
      },

      _navigateHome: function () {
        var homeView = this.pageContainer.getViewByTitle('Home');
        homeView._clearStore();
        homeView._clearMapping();
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