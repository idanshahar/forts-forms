class FormsController {
  constructor() {
    this.currentBlock = null;
    this.currentField = null;
    this.isQueryMode = false;
    this.isDirty = false;
    this.fields = new Map();
    this.blocks = new Map();
    this.lovs = new Map();
    this.triggers = new Map();
    
    this.initKeyHandlers();
  }

  initKeyHandlers() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'Tab':
          e.preventDefault();
          this.navigateNext();
          break;
        case 'Enter':
          e.preventDefault(); 
          this.navigateNext();
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
          this.save();
          break;
        case 'F6':
          e.preventDefault();
          this.clearForm();
          break;
      }
    });
  }

  registerField(blockName, fieldName, element, required = false, lovName = null) {
    if (!this.blocks.has(blockName)) {
      this.blocks.set(blockName, new Map());
    }
    
    const field = {
      element,
      required,
      lovName,
      value: element.value,
      originalValue: element.value
    };
    
    this.fields.set(`${blockName}.${fieldName}`, field);
    this.blocks.get(blockName).set(fieldName, field);
    
    element.addEventListener('change', () => {
      this.handleFieldChange(blockName, fieldName);
    });
    
    element.addEventListener('focus', () => {
      this.currentBlock = blockName;
      this.currentField = fieldName;
    });
  }

  registerLov(lovName, config) {
    this.lovs.set(lovName, config);
  }

  registerTrigger(triggerName, callback) {
    this.triggers.set(triggerName, callback);
  }

  async handleFieldChange(blockName, fieldName) {
    const field = this.fields.get(`${blockName}.${fieldName}`);
    field.value = field.element.value;
    this.isDirty = true;

    if (field.lovName) {
      await this.handleLov(field);
    }

    this.executeTrigger('WHEN_VALIDATE_FIELD', {
      blockName,
      fieldName,
      value: field.value
    });
  }

  async handleLov(field) {
    const lov = this.lovs.get(field.lovName);
    if (!lov) return;

    try {
      const result = await lov.query(field.value);
      if (result.length === 1) {
        this.populateLovFields(field.lovName, result[0]);
      } else if (result.length > 1) {
        this.showLovDialog(field.lovName, result);
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  navigateNext() {
    const fields = Array.from(this.fields.values());
    const currentIndex = fields.findIndex(f => 
      f.element === document.activeElement
    );
    
    if (currentIndex > -1 && currentIndex < fields.length - 1) {
      fields[currentIndex + 1].element.focus();
    }
  }

  async enterQuery() {
    this.isQueryMode = true;
    this.clearForm();
    this.executeTrigger('ENTER_QUERY_MODE');
  }

  async executeQuery() {
    if (!this.isQueryMode) return;
    
    try {
      const queryParams = this.getQueryParams();
      const results = await this.queryData(queryParams);
      
      if (results.length > 0) {
        this.populateForm(results[0]);
      }
      
      this.isQueryMode = false;
      this.executeTrigger('AFTER_QUERY');
    } catch (err) {
      this.handleError(err);
    }
  }

  getQueryParams() {
    const params = {};
    for (const [key, field] of this.fields) {
      if (field.value) {
        params[key] = field.value;
      }
    }
    return params;
  }

  async save() {
    if (!this.validateForm()) return;

    try {
      const data = this.getFormData();
      await this.saveData(data);
      
      this.isDirty = false;
      this.executeTrigger('AFTER_SAVE');
    } catch (err) {
      this.handleError(err);
    }
  }

  validateForm() {
    let isValid = true;
    
    for (const [key, field] of this.fields) {
      if (field.required && !field.value) {
        this.showError(`Field ${key} is required`);
        field.element.focus();
        isValid = false;
        break;
      }
    }
    
    return isValid;
  }

  clearForm() {
    for (const field of this.fields.values()) {
      field.element.value = '';
      field.value = '';
    }
    this.isDirty = false;
  }

  async queryData(params) {
    // Implementation depends on backend API
    throw new Error('queryData must be implemented');
  }

  async saveData(data) {
    // Implementation depends on backend API
    throw new Error('saveData must be implemented');
  }

  populateForm(data) {
    for (const [key, value] of Object.entries(data)) {
      const field = this.fields.get(key);
      if (field) {
        field.element.value = value;
        field.value = value;
        field.originalValue = value;
      }
    }
  }

  executeTrigger(triggerName, context = {}) {
    const trigger = this.triggers.get(triggerName);
    if (trigger) {
      trigger(context);
    }
  }

  showError(message) {
    // Implementation depends on UI framework
    console.error(message);
  }

  handleError(error) {
    this.showError(error.message);
    this.executeTrigger('ON_ERROR', { error });
  }

  showLovDialog(lovName, data) {
    // Implementation depends on UI framework
    console.log(`Show LOV dialog for ${lovName}`, data);
  }

  populateLovFields(lovName, data) {
    const lov = this.lovs.get(lovName);
    if (!lov || !lov.mappings) return;

    for (const [sourceProp, targetField] of Object.entries(lov.mappings)) {
      const field = this.fields.get(targetField);
      if (field && data[sourceProp] !== undefined) {
        field.element.value = data[sourceProp];
        field.value = data[sourceProp];
      }
    }
  }
}

// Usage Example:
const formsApp = new FormsController();

// Register fields
formsApp.registerField('EMPLOYEES', 'EMPLOYEE_ID', 
  document.getElementById('emp_id'), true);
formsApp.registerField('EMPLOYEES', 'FIRST_NAME',
  document.getElementById('first_name'), true);
formsApp.registerField('EMPLOYEES', 'DEPARTMENT',
  document.getElementById('dept'), false, 'DEPT_LOV');

// Register LOV
formsApp.registerLov('DEPT_LOV', {
  query: async (searchTerm) => {
    // Implementation to fetch departments
    return [];
  },
  mappings: {
    DEPT_ID: 'EMPLOYEES.DEPARTMENT',
    DEPT_NAME: 'EMPLOYEES.DEPARTMENT_NAME'
  }
});

// Register triggers
formsApp.registerTrigger('WHEN_VALIDATE_FIELD', (context) => {
  // Field validation logic
});

formsApp.registerTrigger('AFTER_QUERY', () => {
  // Post-query logic
});