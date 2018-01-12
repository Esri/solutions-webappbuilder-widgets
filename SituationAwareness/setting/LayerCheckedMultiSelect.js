define([
  'dojo/_base/declare',
  'dojox/form/CheckedMultiSelect',
  'dojo/_base/array',
  'dojo/_base/lang'
],
  function (declare, CheckedMultiSelect, array, lang) {
    return declare(CheckedMultiSelect, {
      startup: function () {
        this.inherited(arguments);
        setTimeout(lang.hitch(this, function () {
          this.dropDownButton.set("label", this.label);
        }));
      },

      _updateSelection: function () {
        this.inherited(arguments);
        if (this.dropDown && this.dropDownButton) {
          var count = 0;
          array.forEach(this.options, function (option) {
            count += option.selected ? 1 : 0;
          });
          this.dropDownButton.set("label", count > 0 ? count + this.nlsValue : this.label);
        }
      }
    });
  });
