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
  'dojo/Evented',
  'dojo/query',
  'dojo/dom-class',
  'dojo/Deferred',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dojo/on',
  'dojox/gfx/fx',
  'dojo/text!./templates/FeatureToolbar.html',
  'esri/toolbars/edit',
  'jimu/dijit/Message',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/Color',
  'esri/graphic'
],
  function (declare,
    lang,
    array,
    Evented,
    query,
    domClass,
    Deferred,
    _WidgetBase,
    _TemplatedMixin,
    on,
    fx,
    template,
    Edit,
    Message,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    Color,
    Graphic) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,

      'baseClass': 'cf-feature-toolbar',
      declaredClass: 'FeatureToolbar',
      label: "FeatureToolbar",

      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      feature: null,
      layer: null,
      theme: '',
      isDarkTheme: '',
      locators: [],
      styleColor: '',
      featureView: null,
      _editToolbar: null,
      csvStore: null,
      _isAddressFeature: true,
      _stageLayer: null,

      //TODO should this support the option to reset values to defaults if they have made temp changes?
      //TODO need to test/handle situations where the address is not located sucessfully on locate calls

      constructor: function (options) {
        lang.mixin(this, options);

        //enable editing when pencil is clicked
        this._editDisabled = true;

        //enable save when change to geometry or attributes
        this._saveDisabled = true;

        //enable locate when change to address
        this._locateDisabled = true;

        //enable when address is re-located
        this._syncDisabled = true;

        //Used to store and listen when a change occurs
        this._hasAttributeEdit = false;
        this.own(on(this.featureView, 'attribute-change', lang.hitch(this, this._attributeChange)));

        this._hasAddressEdit = false;
        this.own(on(this.featureView, 'address-change', lang.hitch(this, this._addressChange)));

        this._hasGeometryEdit = false;
        this.own(on(this._editToolbar, 'graphic-move-stop', lang.hitch(this, this._graphicMoveStop)));
        this.own(on(this.featureView, 'address-located', lang.hitch(this, this._graphicMoveStop)));

        //TODO this should be done once earlier in the process rather than on every single view
        this.locator = this._getLocator();

        //get the original field and location values for comparison and possibly to support a reset
        this._initOriginalValues();
      },

      postCreate: function () {
        this.inherited(arguments);
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;
        this.featureView._toggleEditControls(this._editDisabled);
      },

      _getLocator: function () {
        //TODO need to have a backup if none of the locators support location to address
        var locator;
        for (var i = 0; i < this.csvStore._geocodeSources.length; i++) {
          var locatorSource = this.csvStore._geocodeSources[0];
          locator = locatorSource.locator;
          if (locator.locationToAddress) {
            break;
          }
        }
        if (locator) {
          locator.outSpatialReference = this.featureView.parent.editLayer.spatialReference;
        }
        return locator;
      },

      _initOriginalValues: function () {
        //These could be used for comparison or to support reset
        this._originalValues = lang.clone(this.featureView.feature);
      },

      _attributeChange: function (v) {
        this._hasAttributeEdit = v;
        if (this.featureView.isDuplicate && this.featureView._useGeomFromLayer) {
          this._updateSave(!(this._hasAttributeEdit));
        } else {
          this._updateSave(!(this._hasAttributeEdit || this._hasGeometryEdit));
        }
      },

      _addressChange: function (v) {
        this._hasAddressEdit = v;
        this._updateLocate(!v);
      },

      _graphicMoveStop: function (result) {
        if (this.featureView.isShowing) {
          this._hasGeometryEdit = true;
          if (this.featureView.isDuplicate && this.featureView._useGeomFromLayer) {
            this._updateSave(!(this._hasAttributeEdit));
          } else {
            this._updateSave(!(this._hasAttributeEdit || this._hasGeometryEdit));
          }
          this.map.infoWindow.setFeatures(this.featureView._feature);
          this.map.infoWindow.select(0);

          //I fire graphicMoveStop when locating...in that case it's based off of the address the user entered
          //no need to reverse geocode again
          if (result) {
            this._reverseLocate(result.graphic.geometry);
          }
          if (this.featureView._validateAddressDifference()) {
            this._updateSync(false);
          }
        }
      },

      _reverseLocate: function (geometry) {
        var def = new Deferred();
        if (this._isAddressFeature) {
          this.locator.locationToAddress(geometry).then(lang.hitch(this, function (result) {
            //TODO should this honor the configured match score limit...if
            this.featureView._updateAddressFields(result.address, false);
            def.resolve({ address: result.address });
          }));
        } else {
          //TODO support the same for coiordinate feature...should return xy
          this.featureView._updateAddressFields(geometry, false);
          def.resolve({ geometry: geometry });
        }
        return def;
      },

      _disableEdit: function () {
        this._editDisabled = false;
        this._toggleEdit();
      },

      _toggleEdit: function () {
        this._editDisabled = !this._editDisabled;
        this._updateEdit(this._editDisabled);

        this.featureView._toggleEditControls(this._editDisabled);

        if (this.map.infoWindow.isShowing) {
          this.map.infoWindow.hide();
        }

        if (!this._editDisabled) {
          this._editToolbar.activate(Edit.MOVE, this.featureView._feature);
          if (this.featureView.isDuplicate) {
            this._flashFeatures([this.featureView._useGeomFromFile ?
              this.featureView._feature : this.featureView._editFeature]);
            if (this.featureView._useGeomFromFile) {
              this._updateSave(!(this._hasAttributeEdit || this._hasGeometryEdit));
            } else {
              this._updateSave(!(this._hasAttributeEdit));
            }
          } else {
            this._panToAndSelectFeature(this.featureView._feature);
            this._updateSave(!(this._hasAttributeEdit || this._hasGeometryEdit));
          }
          this._updateLocate(!this._hasAddressEdit);
          if ((this._hasGeometryEdit && this._locateDisabled) ||
            (this.featureView.isDuplicate && this.featureView._useValuesFromLayer)) {
            this._updateSync(!this.featureView._validateAddressDifference());
          } else {
            this._updateSync(true);
          }
        } else {
          this._editToolbar.refresh();
          this._editToolbar.deactivate();
          this._updateSave(true);
          this._updateLocate(true);
          this._updateSync(true);
          this._undoEdits();
          this.map.infoWindow.clearFeatures();
        }
      },

      _undoEdits: function () {
        //reset all controls with the original values
        if (this._hasAttributeEdit) {
          this.featureView.resetAttributeValues(this._originalValues);
          this._hasAttributeEdit = false;
        }
        if (this._hasAddressEdit || this._hasGeometryEdit) {
          this.featureView.resetAddressValues(this._originalValues);
          this._hasAddressEdit = false;
        }

        if (this._hasGeometryEdit){
          this.featureView.resetGeometry(this._originalValues.geometry, this._originalValues.duplicateGeometry);
          this._hasGeometryEdit = false;
        }
      },

      _locate: function () {
        if (!this._locateDisabled) {
          //locate feature
          this._locateFeature().then(lang.hitch(this, function () {
            //disable locate
            this._hasAddressEdit = false;
            this._updateLocate(true);
          }));
        }
      },

      _save: function (forceSave) {
        //forceSave === true bypasses _saveDisabled check
        // allows a duplicate record to be saved in pretty much the same way as an unmatched record

        if (!this._saveDisabled || forceSave === true) {
          if (forceSave !== true) {
            //update the feature instances based on changes in user controls
            this._setFieldValues(this.featureView);
            this._setAddressValues(this.featureView);
            this.featureView.feature.geometry = this.featureView._feature.geometry;
            this._originalValues.geometry = this.featureView._feature.geometry;
            if (this.featureView.isDuplicate) {
              this._originalValues.duplicateGeometry = this.featureView._feature.geometry;
            }
          }

          var updateFeature = this.featureView._feature;
          if (this.featureView.label.indexOf('UnMatched') === -1 &&
            this.featureView.label.indexOf('DuplicateFeatures') === -1) {
            //matched features will remain in the matched layer on save
            this._updateLayer(this._stageLayer, null, [updateFeature], null, true, false);
          } else if (this.featureView.isDuplicate && forceSave !== true) {
            //duplicate features will remain in the duplicate layer on save
            //the hasUpdate attributes will be reviewed on submit to understand when update vs add should occur
            this.featureView._updateDuplicateAttributes(null, true);
            this._updateLayer(this.layer, null, [updateFeature], null, true, false);
          } else {
            //unmatched features will be saved to the matched layer when they can be located or after the graphic is moved on save
            // the feature and view should be removed from the unmatched layer and list
            var oid = updateFeature.attributes[this.layer.objectIdField];

            //delete from un-matched layer
            this._updateLayer(this.layer, null, null, [updateFeature], true, false).then(lang.hitch(this, function (r) {
              if (r && r.status === 'success') {
                var list = this.featureView._parentFeatureList;
                list.removeFeature(this.featureView.feature, oid).then(lang.hitch(this, function () {
                  //remove current view from page container
                  this.parent._pageContainer.removeViewByTitle(this.featureView.label);

                  array.forEach(this.featureView._skipFields, lang.hitch(this, function (sf) {
                    delete updateFeature.attributes[sf];
                  }));

                  //Add the new
                  this._updateLayer(this._stageLayer, [updateFeature], null, null, true, false)
                    .then(lang.hitch(this, function (result) {
                      if (result && result.status === 'success') {
                        console.log(updateFeature.geometry);
                        if (result.hasOwnProperty('objectId')) {
                          //update the feature view feature OID with the new OID prior to adding the feature to the list
                          var oidField = this.featureView.feature.fieldInfo.filter(lang.hitch(this, function (field) {
                            return field.name === this._stageLayer.objectIdField;
                          }))[0];
                          oidField.value = result.objectId;
                        }
                        //update matched list
                        //need to get review and then _matchedListView from it
                        var reviewView = this.parent._pageContainer.getViewByTitle('Review');
                        reviewView.matchedFeatureList.addFeature(this.featureView.feature);
                        reviewView._updateReviewRows((forceSave === true) ? 'duplicate' : 'unmatched');
                      }
                    }));

                }));
              }
            }));
          }

          if (forceSave !== true) {
            //disable save
            this._updateSave(true);
            //toggle edit
            this._toggleEdit();
          }
        }
      },

      _updateLayer: function (layer, adds, updates, deletes, setFlags, bypassSubmitCheck) {
        //bypassSubmitCheck allows update to occur without changing the submit button state when edits are cancelled
        var def = new Deferred();
        layer.applyEdits(adds, updates, deletes).then(lang.hitch(this, function (addRes, updateRes, deleteRes) {
          console.log(updateRes);
          console.log(deleteRes);
          var result = { status: "success" };
          if (setFlags) {
            this._hasGeometryEdit = false;
            this._hasAttributeEdit = false;
          }
          if (addRes && addRes.hasOwnProperty('length') && addRes.length > 0 && addRes[0].hasOwnProperty('objectId')) {
            result.objectId = addRes[0].objectId;
          }

          if (!bypassSubmitCheck && updates && updates.hasOwnProperty('length') && updates.length > 0) {
            //enable submit
            var reviewView = this.featureView.parent._pageContainer.getViewByTitle('Review');
            reviewView._updateNode(reviewView.submitButton, true);
          }
          def.resolve(result);
        }), lang.hitch(this, function (err) {
          def.resolve({ status: "error", error: err });
          new Message({
            message: this.nls.warningsAndErrors.saveError
          });
        }));
        return def;
      },

      _setFieldValues: function (featureView) {
        var editIndexes = featureView._changedAttributeRows;
        var useFile = featureView._useValuesFromFile;
        var _feature = featureView._feature;
        var feature = featureView.feature;
        array.forEach(featureView.featureControlTable.rows, function (row) {
          if (row.isEditRow && editIndexes.indexOf(row.rowIndex) > -1) {
            var control = (row.parent.isDuplicate && !useFile) ? row.layerValueTextBox : row.fileValueTextBox;
            _feature.attributes[row.fieldName] = control.value;
            var fieldInfo = feature.fieldInfo.filter(function (f) {
              return f.name === row.fieldName;
            })[0];
            fieldInfo.value = control.value;

            if (row.parent.isDuplicate && !useFile) {
              row.layerValue = control.value;
            } else {
              row.fileValue = control.value;
            }
            control.textbox.title = control.value;
          }
        });
      },

      _setAddressValues: function (featureView) {
        var addr = featureView._getAddress();
        var matchFieldPrefix = this.csvStore.matchFieldPrefix;
        array.forEach(featureView.addressFields, function (addrField) {
          var matchField = matchFieldPrefix + addrField.keyField;
          var field = featureView.feature.fieldInfo.filter(function (fi) {
            return fi.name === matchField;
          })[0];
          field.value = addr[matchField];

          var row = Array.from(featureView.locationControlTable.rows).filter(function (r) {
            return r.isAddressRow ? r.keyField === addrField.keyField : false;
          })[0];
          row.addressValueTextBox.textbox.title = addr[matchField];
          row.addressValue = addr[matchField];
        });
      },

      _updateFeature: function (location, address, skipApplyEdits, bypassSubmitCheck) {
        console.log(address);
        var fv = this.featureView;
        fv.feature.geometry = location;
        fv._feature.geometry = location;

        var features = [fv._feature];

        if (fv.isDuplicate) {
          this._hasGeometryEdit = ((fv._editFeature.geometry.x !== fv._feature.geometry.x) ||
            (fv._editFeature.geometry.y !== fv._feature.geometry.y));
        }

        if (!skipApplyEdits) {
          this._updateLayer(fv.layer, null, features, null, false, bypassSubmitCheck)
            .then(lang.hitch(this, function (result) {
              if (result && result.status === 'success') {
                this._panToAndSelectFeature(fv._feature);
                fv.emit('address-located');
              }
            }));
        }
      },

      _locateFeature: function (skipApplyEdits) {
        //skipApplyEdits is used to bypass applyEdits call to local layer when locating a
        // feature that was identified as a potential duplicate and the user then said it was not
        // a duplicate
        var def = new Deferred();
        var address = this.featureView._getAddressFieldsValues();
        if (this._isAddressFeature) {
          this._addressToLocation(address).then(lang.hitch(this, function (locationItem) {
            this._updateFeature(locationItem.location, locationItem.address, skipApplyEdits, true);
            def.resolve({
              feature: this.featureView.feature,
              address: locationItem.address
            });
          }));
        } else {
          var geometry = this.csvStore._getGeometry(address[this.xField], address[this.yField]);
          this._updateFeature(geometry, address, skipApplyEdits, true);
          def.resolve({
            feature: this.featureView.feature,
            geometry: geometry
          });
        }
        return def;
      },

      _addressToLocation: function (address) {
        var def = new Deferred();
        address.maxLocations = 1;
        this.locator.addressToLocations(address).then(lang.hitch(this, function (result) {
          var highestScoreItem;
          if (result && result.length > 0) {
            array.forEach(result, function (item) {
              if (typeof (highestScoreItem) === 'undefined') {
                highestScoreItem = item;
              }
              console.log(item.location);
              if (highestScoreItem && item.score > highestScoreItem.score) {
                highestScoreItem = item;
              }
            });
            def.resolve(highestScoreItem);
          }
        }));
        return def;
      },

      _flashFeatures: function (features) {
        var layer;
        array.forEach(features, lang.hitch(this, function (feature) {
          if (feature.geometry) {
            var color = Color.fromHex(this.styleColor);
            var color2 = lang.clone(color);
            color2.a = 0.4;
            var symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 15,
              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 1), color2);

            var g = new Graphic(feature.geometry, symbol);
            this.map.graphics.add(g);
            layer = g.getLayer ? g.getLayer() : layer;
            var dShape = g.getDojoShape();
            if (dShape) {
              fx.animateStroke({
                shape: dShape,
                duration: 900,
                color: {
                  start: dShape.strokeStyle.color,
                  end: dShape.strokeStyle.color
                },
                width: {
                  start: 25,
                  end: 0
                }
              }).play();
            }
          }
        }));
        setTimeout(function (layer) {
          if (layer && layer.clear) {
            layer.clear();
          }
        }, 1200, layer);
      },

      _panToAndSelectFeature: function (feature) {
        if (feature && feature.geometry) {
          var maxZoom = this.map.getMaxZoom();
          this.map.centerAndZoom(feature.geometry, Math.round(maxZoom / 2)).then(lang.hitch(this, function () {
            this._flashFeatures([feature]);
            if ((feature._layer && feature._layer.infoTemplate) || feature.infoTemplate) {
              this.map.infoWindow.setFeatures([feature]);
              this.map.infoWindow.select(0);
            }
          }));
        }
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      _updateEdit: function (disabled) {
        this._editDisabled = disabled;
        this._updateImageNode('bg-edit', 'bg-edit-white', 'bg-edit-disabled',
          this._editDisabled, this.domNode);
      },

      _updateSave: function (disabled) {
        this._saveDisabled = disabled;
        this._updateImageNode('bg-save', 'bg-save-white', 'bg-save-disabled',
          this._saveDisabled, this.domNode);
      },

      _updateLocate: function (disabled) {
        this._locateDisabled = disabled;
        this._updateImageNode('bg-locate', 'bg-locate-white', 'bg-locate-disabled',
          this._locateDisabled, this.domNode);
      },

      _updateSync: function (disabled) {
        this._syncDisabled = disabled;
        this._updateImageNode('bg-sync', 'bg-sync-white', 'bg-sync-disabled',
          this._syncDisabled, this.featureView.syncFields.domNode);
      },

      updateImageNodes: function () {
        //toggle all images
        this._updateImageNode('bg-edit', 'bg-edit-white', 'bg-edit-disabled',
          this._editDisabled, this.domNode);
        this._updateImageNode('bg-save', 'bg-save-white', 'bg-save-disabled',
          this._saveDisabled, this.domNode);
        this._updateImageNode('bg-locate', 'bg-locate-white', 'bg-locate-disabled',
          this._locateDisabled, this.domNode);
        this._updateImageNode('bg-sync', 'bg-sync-white', 'bg-sync-disabled',
          this._syncDisabled, this.featureView.syncFields.domNode);
      },

      _updateImageNode: function (img, imgWhite, imgDisabled, isDisabled, node) {
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        var addClass = isDisabled ? imgDisabled : isDark ? imgWhite : img;

        //var removeClass = isDark ? img : imgWhite;
        var removeClass = imgWhite;
        var nodesFound = false;
        var imageNodes = query('.' + img, node);
        if (imageNodes.hasOwnProperty('length') && imageNodes.length === 0) {
          imageNodes = query('.' + imgDisabled, node);
        } else {
          nodesFound = true;
          removeClass = img;
        }

        if (!nodesFound && imageNodes.hasOwnProperty('length') && imageNodes.length === 0) {
          imageNodes = query('.' + imgWhite, node);
        } else {
          if (!nodesFound) {
            nodesFound = true;
            removeClass = imgDisabled;
          }
        }
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      updateTheme: function (theme) {
        this.theme = theme;
      }
    });
  });