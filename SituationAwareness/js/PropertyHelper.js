///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
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

define(['dojo/_base/declare',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/_base/lang',
  'dojo/_base/html',
  'dojo/dom-class',
  'dojo/on',
  'dojo/query',
  'dojo/Deferred',
  'jimu/BaseWidget',
  'jimu/portalUtils',
  'dojo/Evented',
  'dojo/text!./PropertyHelper.html',
  'dijit/form/Select',
  'dijit/form/ValidationTextBox'],
function (declare,
  _WidgetsInTemplateMixin,
  lang,
  html,
  domClass,
  on,
  query,
  Deferred,
  BaseWidget,
  portalUtils,
  Evented,
  template,
  Select) {
  return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
    //single widget to collect props for snapshot or report
    templateString: template,

    baseClass: 'jimu-widget-SAT-property-helper',

    constructor: function () {

    },

    postMixInProperties: function () {
      this.inherited(arguments);
      this.nls.common = window.jimuNls.common;
    },

    postCreate: function () {
      this.inherited(arguments);
      if (this.type === 'report') {
        this.initReportControls();
      } else {
        this.initSnapshotControls();
      }
      this.startup();
    },

    startup: function () {
      this.snapshotName.invalidMessage = this.invalidMessage;
      this.snapshotName.validator = this.type === 'report' ? this.checkReportString : this.checkString;

      this.btnCancel.innerText = this.nls.common.cancel;
      this.own(on(this.btnCancel, 'click', lang.hitch(this, function () {
        this.emit('cancel');
      })));

      this.btnOk.innerText = this.nls.common.ok;
      this.own(on(this.btnOk, 'click', lang.hitch(this, function () {
        if (!domClass.contains(this.btnOk, 'jimu-state-disabled')) {
          var props = {
            name: this.snapshotName.value.trim()
          };
          if (this.type === 'report') {
            props = lang.mixin(props, {
              reportLayout: {
                orientation: this.pageUtils.Orientation[this.orientationSelect.selectControl.value],
                pageSize: this.pageUtils.PageSizes[this.pageSizeSelect.selectControl.value]
              },
              comments: this.commentTextArea.value
            });
          } else {
            props.groups = [this.shareSelect.selectControl.value !== this.nls.choose_group ?
              this.shareSelect.selectControl.value : ''];
          }
          this.emit('ok', props);
        }
      })));
    },

    checkString: function (val) {
      var v = val.trim();
      //less than 50 characters and has alphanumeric characters can contain spaces and underscores
      var valid = (v.length < 50) && /^[\w ]+$/.test(v) ? true : false;
      var s = query('.snapshot-name-footer')[0];
      if (s) {
        if (this.hasNoGroups) {
          html.addClass(s.children[0], 'jimu-state-disabled');
        } else {
          if (!valid) {
            html.addClass(s.children[0], 'jimu-state-disabled');
          } else {
            html.removeClass(s.children[0], 'jimu-state-disabled');
          }
        }
      }
      return valid;
    },

    checkReportString: function (val) {
      var v = val.trim();
      var valid = (v.length > 0) ? true : false;
      var s = query('.snapshot-name-footer')[0];
      if (s) {
        if (!valid) {
          html.addClass(s.children[0], 'jimu-state-disabled');
        } else {
          html.removeClass(s.children[0], 'jimu-state-disabled');
        }
      }
      return valid;
    },

    getPageUtilValues: function (pageUtilObj, kName, defaultValue) {
      var supportedPageUtilValues = ['A3', 'A4', 'Letter_ANSI_A', 'Tabloid_ANSI_B', 'Landscape', 'Portrait'];
      var baseDefaults = ['Letter ANSI A', 'Portrait'];
      var keys = Object.keys(pageUtilObj);
      var values = [];
      for (var k in keys) {
        var _k = keys[k];
        var obj = pageUtilObj[_k];
        if (_k && obj.hasOwnProperty(kName) && supportedPageUtilValues.indexOf(_k) > -1) {
          values.push({
            label: obj[kName],
            value: _k,
            selected: obj[kName] === defaultValue || baseDefaults.indexOf(obj[kName]) > -1
          });
        }
      }
      return values;
    },

    getGroupValues: function (defaultValue) {
      var def = new Deferred();
      var portal = portalUtils.getPortal(this.portalUrl);
      portal.getUser().then(lang.hitch(this, function (user) {
        var values = [];
        for (var k in user.groups) {
          var g = user.groups[k];
          values.push({
            label: g.title,
            value: g.id,
            selected: g.title === defaultValue
          });
        }
        def.resolve(values);
      }), lang.hitch(this, function (err) {
        console.log(err);
        def.resolve([]);
      }));
      return def;
    },

    initSnapshotControls: function () {
      this.nameSpan.innerHTML = this.nls.common.name + ":";
      this.shareSpan.innerHTML = this.nls.select_group + ":";
      this.toggleRow(this.shareRow, false);
      this.toggleRow(this.orientationRow, true);
      this.toggleRow(this.pageSizeRow, true);
      this.toggleRow(this.commentsRow, true);

      var defaultShare;
      if (this.storedProps !== null) {
        var props = JSON.parse(this.storedProps, true);
        if (props.share) {
          defaultShare = props.share;
        }
      }

      this.getGroupValues(defaultShare).then(lang.hitch(this, function (vals) {
        if (vals.length === 0) {
          this.snapshotName.hasNoGroups = true;
        } else {
          this.snapshotName.hasNoGroups = false;
        }
        this.addSelect(this.shareSelect, vals);
      }));
    },

    initReportControls: function () {
      this.nameSpan.innerHTML = this.nls.common.title + ":";
      this.toggleRow(this.orientationRow, false);
      this.toggleRow(this.pageSizeRow, false);
      this.toggleRow(this.commentsRow, false);
      this.toggleRow(this.shareRow, true);

      var defaultO;
      var defaultP;
      if (this.storedProps !== null) {
        var props = JSON.parse(this.storedProps, true);
        if (props.reportLayout) {
          var orientation = props.reportLayout.orientation;
          var pageSize = props.reportLayout.pageSize;
          defaultO = orientation.Text;
          defaultP = pageSize.SizeName;
        }
      }

      this.addSelect(this.orientationSelect, this.getPageUtilValues(this.pageUtils.Orientation, "Text", defaultO));
      this.addSelect(this.pageSizeSelect, this.getPageUtilValues(this.pageUtils.PageSizes, "SizeName", defaultP));
    },

    addSelect: function (node, values) {
      node.selectControl = new Select({
        options: values,
        style: "width: 100%;"
      });
      node.selectControl.placeAt(node).startup();
    },

    toggleRow: function (node, hide) {
      if (domClass.contains(node, hide ? 'display-on' : 'display-off')) {
        domClass.remove(node, hide ? 'display-on' : 'display-off');
      }
      domClass.add(node, !hide ? 'display-on' : 'display-off');
    },

    destroy: function () {

    }
  });
});
