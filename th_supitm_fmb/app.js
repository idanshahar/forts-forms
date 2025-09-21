// Form Controller Class
class FormsController {
  constructor() {
    this.fields = new Map();
    this.currentField = null;
    this.queryMode = false;
    this.modified = false;
    this.initializeKeyHandlers();
  }

  initializeField(fieldName, required = false, lovId = null) {
    const field = {
      name: fieldName,
      required: required,
      value: '',
      lovId: lovId,
      valid: true,
      errorMsg: ''
    };
    this.fields.set(fieldName, field);
  }

  initializeKeyHandlers() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'Tab':
          this.handleTabNavigation(e.shiftKey);
          break;
        case 'Enter':
          this.handleEnterKey();
          break;
        case 'F7':
          if (e.preventDefault) e.preventDefault();
          this.enterQuery();
          break;
        case 'F8':
          if (e.preventDefault) e.preventDefault();
          this.executeQuery();
          break;
        case 'F10':
          if (e.preventDefault) e.preventDefault();
          this.saveRecord();
          break;
        case 'F6':
          if (e.preventDefault) e.preventDefault();
          this.clearRecord();
          break;
      }
    });
  }

  handleTabNavigation(isShiftKey) {
    const fields = Array.from(this.fields.keys());
    const currentIndex = fields.indexOf(this.currentField);
    let nextIndex;
    
    if (isShiftKey) {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
    } else {
      nextIndex = currentIndex < fields.length - 1 ? currentIndex + 1 : 0;
    }
    
    this.setFocus(fields[nextIndex]);
  }

  handleEnterKey() {
    const field = this.fields.get(this.currentField);
    if (field && field.lovId) {
      this.showLOV(field.lovId);
    } else {
      this.handleTabNavigation(false);
    }
  }

  validateField(fieldName) {
    const field = this.fields.get(fieldName);
    if (!field) return false;

    field.valid = true;
    field.errorMsg = '';

    if (field.required && !field.value) {
      field.valid = false;
      field.errorMsg = 'Field is required';
      return false;
    }

    return true;
  }

  validateForm() {
    let isValid = true;
    this.fields.forEach((field) => {
      if (!this.validateField(field.name)) {
        isValid = false;
      }
    });
    return isValid;
  }

  setFieldValue(fieldName, value) {
    const field = this.fields.get(fieldName);
    if (field) {
      field.value = value;
      this.modified = true;
      this.validateField(fieldName);
      this.triggerFieldChange(fieldName);
    }
  }

  getFieldValue(fieldName) {
    const field = this.fields.get(fieldName);
    return field ? field.value : null;
  }

  setFocus(fieldName) {
    this.currentField = fieldName;
    const element = document.getElementById(fieldName);
    if (element) {
      element.focus();
    }
  }

  showLOV(lovId) {
    // Implementation for List of Values dialog
    const lovDialog = new LOVDialog(lovId, (selectedValue) => {
      this.setFieldValue(this.currentField, selectedValue);
    });
    lovDialog.show();
  }

  enterQuery() {
    this.queryMode = true;
    this.clearRecord(true);
    this.setFocus(Array.from(this.fields.keys())[0]);
  }

  executeQuery() {
    if (!this.queryMode) return;
    
    const queryParams = {};
    this.fields.forEach((field, fieldName) => {
      if (field.value) {
        queryParams[fieldName] = field.value;
      }
    });

    this.performQuery(queryParams);
    this.queryMode = false;
  }

  async performQuery(params) {
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) throw new Error('Query failed');
      
      const data = await response.json();
      this.loadRecord(data);
    } catch (error) {
      this.showError('Query Error', error.message);
    }
  }

  async saveRecord() {
    if (!this.validateForm()) {
      this.showError('Validation Error', 'Please correct invalid fields');
      return;
    }

    const record = {};
    this.fields.forEach((field, fieldName) => {
      record[fieldName] = field.value;
    });

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
      });

      if (!response.ok) throw new Error('Save failed');

      this.modified = false;
      this.showMessage('Success', 'Record saved successfully');
    } catch (error) {
      this.showError('Save Error', error.message);
    }
  }

  clearRecord(keepFocus = false) {
    const currentField = this.currentField;
    this.fields.forEach(field => {
      field.value = '';
      field.valid = true;
      field.errorMsg = '';
    });
    this.modified = false;
    
    if (!keepFocus) {
      this.setFocus(Array.from(this.fields.keys())[0]);
    } else if (currentField) {
      this.setFocus(currentField);
    }
  }

  loadRecord(data) {
    this.clearRecord();
    Object.entries(data).forEach(([fieldName, value]) => {
      this.setFieldValue(fieldName, value);
    });
    this.modified = false;
  }

  triggerFieldChange(fieldName) {
    const event = new CustomEvent('fieldChange', {
      detail: {
        fieldName: fieldName,
        value: this.getFieldValue(fieldName)
      }
    });
    document.dispatchEvent(event);
  }

  showError(title, message) {
    // Implementation for error dialog
    console.error(`${title}: ${message}`);
    alert(`${title}\n${message}`);
  }

  showMessage(title, message) {
    // Implementation for message dialog
    console.log(`${title}: ${message}`);
    alert(`${title}\n${message}`);
  }
}

// List of Values Dialog Class
class LOVDialog {
  constructor(lovId, callback) {
    this.lovId = lovId;
    this.callback = callback;
  }

  async show() {
    try {
      const response = await fetch(`/api/lov/${this.lovId}`);
      if (!response.ok) throw new Error('Failed to fetch LOV data');
      
      const data = await response.json();
      this.displayLOVDialog(data);
    } catch (error) {
      console.error('LOV Error:', error);
    }
  }

  displayLOVDialog(data) {
    // Implementation for LOV dialog display
    const selected = prompt('Select value:', data.join('\n'));
    if (selected && this.callback) {
      this.callback(selected);
    }
  }
}

// Initialize form controller
const formsController = new FormsController();