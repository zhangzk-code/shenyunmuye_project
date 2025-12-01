/**
 * 字段验证器
 */
export class Validator {
    /**
     * 验证规则
     */
    static rules = {
        required: (value) => {
            if (value === null || value === undefined || value === '') {
                return '此字段为必填项';
            }
            return null;
        },
        email: (value) => {
            if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return '请输入有效的邮箱地址';
            }
            return null;
        },
        url: (value) => {
            if (value && !/^https?:\/\/.+/.test(value)) {
                return '请输入有效的URL地址';
            }
            return null;
        },
        minLength: (min) => (value) => {
            if (value && value.length < min) {
                return `至少需要${min}个字符`;
            }
            return null;
        },
        maxLength: (max) => (value) => {
            if (value && value.length > max) {
                return `最多${max}个字符`;
            }
            return null;
        },
        number: (value) => {
            if (value && isNaN(Number(value))) {
                return '请输入有效的数字';
            }
            return null;
        },
        min: (min) => (value) => {
            if (value && Number(value) < min) {
                return `最小值为${min}`;
            }
            return null;
        },
        max: (max) => (value) => {
            if (value && Number(value) > max) {
                return `最大值为${max}`;
            }
            return null;
        }
    };

    /**
     * 验证字段
     */
    static validate(value, rules = []) {
        for (const rule of rules) {
            let error = null;
            
            if (typeof rule === 'string') {
                // 字符串规则，如 'required'
                error = this.rules[rule] ? this.rules[rule](value) : null;
            } else if (typeof rule === 'function') {
                // 自定义验证函数
                error = rule(value);
            } else if (rule && typeof rule === 'object') {
                // 对象规则，如 { type: 'minLength', params: [5] }
                const ruleFunc = this.rules[rule.type];
                if (ruleFunc) {
                    if (rule.params) {
                        error = ruleFunc(...rule.params)(value);
                    } else {
                        error = ruleFunc(value);
                    }
                }
            }
            
            if (error) {
                return error;
            }
        }
        
        return null;
    }

    /**
     * 验证表单
     */
    static validateForm(formData, schema) {
        const errors = {};
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = formData[field];
            const error = this.validate(value, rules);
            if (error) {
                errors[field] = error;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}

