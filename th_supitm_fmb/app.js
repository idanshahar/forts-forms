// Form Controller Class
class FormsController {
  constructor() {
    this.currentBlock = null;
    this.currentRecord = null;
    this.queryMode = false;
    this.fields = new Map();
    this.blocks = new Map();
    this.lovs = new Map();
    this.dirtyFields = new Set();
    
    this.initializeKeyHandlers();
  }

  initializeKeyHandlers() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'Tab':
          this.handleTabNavigation(e);
          break;
        case 'Enter':
          this.handleEnterKey(e);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          this.handleRecordNavigation(e);
          break;
        case 'F7':
          e.preventDefault();
          this.enterQuery();
          break;
        case 'F8':
          e.preventDefault();
          this.executeQuery();
          break;
        case 'F10':
          e.preventDefault();
          this.saveRecord();
          break;
      }
    });
  }

  registerField(fieldName, element, validation = {}) {
    this.fields.set(fieldName, {
      element,
      validation,
      value: null,
      originalValue: null
    });

    element.addEventListener('change', () => {
      this.handleFieldChange(fieldName);
    });
  }

  registerBlock(blockName, fields) {
    this.blocks.set(blockName, {
      fields,
      currentRecord: 0,
      records: []
    });
  }

  registerLOV(lovName, config) {
    this.lovs.set(lovName, {
      query: config.query,
      returnItems: config.returnItems,
      displayItems: config.displayItems
    });
  }

  async handleFieldChange(fieldName) {
    const field = this.fields.get(fieldName);
    const newValue = field.element.value;
    
    if (this.validateField(fieldName, newValue)) {
      field.value = newValue;
      this.dirtyFields.add(fieldName);
      await this.executeTrigger('WHEN_VALIDATE_ITEM', fieldName);
    }
  }

  validateField(fieldName, value) {
    const field = this.fields.get(fieldName);
    const validation = field.validation;

    if (validation.required && !value) {
      this.showError(`${fieldName} is required`);
      return false;
    }

    if (validation.maxLength && value.length > validation.maxLength) {
      this.showError(`${fieldName} exceeds maximum length of ${validation.maxLength}`);
      return false;
    }

    if (validation.pattern && !validation.pattern.test(value)) {
      this.showError(`${fieldName} has invalid format`);
      return false;
    }

    return true;
  }

  async enterQuery() {
    this.queryMode = true;
    this.clearAllFields();
    await this.executeTrigger('ENTER_QUERY_MODE');
  }

  async executeQuery() {
    if (!this.queryMode) return;
    
    const queryParams = {};
    this.fields.forEach((field, fieldName) => {
      if (field.value) {
        queryParams[fieldName] = field.value;
      }
    });

    try {
      const results = await this.fetchRecords(queryParams);
      this.populateResults(results);
      this.queryMode = false;
    } catch (error) {
      this.showError('Query failed: ' + error.message);
    }
  }

  async saveRecord() {
    if (!this.validateForm()) return;

    const recordData = {};
    this.dirtyFields.forEach(fieldName => {
      recordData[fieldName] = this.fields.get(fieldName).value;
    });

    try {
      await this.executeTrigger('PRE_UPDATE');
      await this.saveToDatabase(recordData);
      await this.executeTrigger('POST_UPDATE');
      this.dirtyFields.clear();
    } catch (error) {
      this.showError('Save failed: ' + error.message);
    }
  }

  async showLOV(lovName) {
    const lov = this.lovs.get(lovName);
    if (!lov) return;

    try {
      const results = await this.executeLOVQuery(lov.query);
      const selected = await this.showLOVDialog(results, lov.displayItems);
      
      if (selected) {
        lov.returnItems.forEach((item, index) => {
          const field = this.fields.get(item);
          if (field) {
            field.element.value = selected[index];
            this.handleFieldChange(item);
          }
        });
      }
    } catch (error) {
      this.showError('LOV error: ' + error.message);
    }
  }

  async executeTrigger(triggerName, context) {
    const triggerFunction = this[`trigger_${triggerName}`];
    if (typeof triggerFunction === 'function') {
      await triggerFunction.call(this, context);
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    } else {
      alert(message);
    }
  }

  validateForm() {
    let isValid = true;
    this.fields.forEach((field, fieldName) => {
      if (!this.validateField(fieldName, field.value)) {
        isValid = false;
      }
    });
    return isValid;
  }

  async fetchRecords(params) {
    // Implementation would depend on backend API
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async saveToDatabase(data) {
    // Implementation would depend on backend API
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  clearAllFields() {
    this.fields.forEach(field => {
      field.element.value = '';
      field.value = null;
    });
    this.dirtyFields.clear();
  }

  handleTabNavigation(event) {
    event.preventDefault();
    const currentElement = document.activeElement;
    const allFields = Array.from(document.querySelectorAll('input, select'));
    const currentIndex = allFields.indexOf(currentElement);
    const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
    
    if (nextIndex >= 0 && nextIndex < allFields.length) {
      allFields[nextIndex].focus();
    }
  }

  handleEnterKey(event) {
    event.preventDefault();
    const currentElement = document.activeElement;
    if (currentElement.tagName === 'INPUT') {
      this.handleTabNavigation(event);
    }
  }

  handleRecordNavigation(event) {
    if (!this.currentBlock) return;
    
    const block = this.blocks.get(this.currentBlock);
    const currentIndex = block.currentRecord;
    
    if (event.key === 'ArrowUp' && currentIndex > 0) {
      this.navigateToRecord(currentIndex - 1);
    } else if (event.key === 'ArrowDown' && currentIndex < block.records.length - 1) {
      this.navigateToRecord(currentIndex + 1);
    }
  }

  navigateToRecord(index) {
    const block = this.blocks.get(this.currentBlock);
    if (!block || !block.records[index]) return;
    
    block.currentRecord = index;
    const record = block.records[index];
    
    Object.entries(record).forEach(([fieldName, value]) => {
      const field = this.fields.get(fieldName);
      if (field) {
        field.element.value = value;
        field.value = value;
      }
    });
  }
}

// Initialize controller
const formsController = new FormsController();