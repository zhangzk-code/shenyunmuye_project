# API接口详细文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 1. 健康检查

**GET** `/api/health`

检查API服务状态

**响应示例**:
```json
{
  "success": true,
  "message": "API服务运行正常",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 2. 提交联系表单

**POST** `/api/contact`

提交用户联系表单

**请求参数**:
```json
{
  "name": "张三",           // 必填，姓名
  "phone": "13800138000",  // 必填，手机号（11位）
  "email": "zhang@example.com",  // 可选，邮箱
  "city": "北京",          // 可选，城市
  "message": "我想咨询产品信息"  // 必填，留言内容
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "提交成功，我们会尽快与您联系！",
  "data": {
    "id": "1705312200000"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "姓名、电话和留言内容为必填项"
}
```

---

## 3. 提交预约设计表单

**POST** `/api/appointment`

提交预约设计表单

**请求参数**:
```json
{
  "name": "李四",           // 必填，姓名
  "phone": "13900139000",  // 必填，手机号（11位）
  "city": "上海",          // 可选，所在城市
  "area": "120平米",       // 可选，房屋面积
  "description": "想要现代简约风格"  // 可选，需求描述
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "预约提交成功，我们的设计师会尽快与您联系！",
  "data": {
    "id": "1705312200000"
  }
}
```

---

## 4. 获取联系记录列表（管理后台）

**GET** `/api/admin/contacts`

获取所有联系记录

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1705312200000",
      "name": "张三",
      "phone": "13800138000",
      "email": "zhang@example.com",
      "city": "北京",
      "message": "我想咨询产品信息",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "status": "pending"
    }
  ],
  "total": 1
}
```

**状态说明**:
- `pending`: 待处理
- `processed`: 已处理
- `archived`: 已归档

---

## 5. 获取预约记录列表（管理后台）

**GET** `/api/admin/appointments`

获取所有预约记录

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1705312200000",
      "name": "李四",
      "phone": "13900139000",
      "city": "上海",
      "area": "120平米",
      "description": "想要现代简约风格",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "status": "pending"
    }
  ],
  "total": 1
}
```

**状态说明**:
- `pending`: 待联系
- `contacted`: 已联系
- `confirmed`: 已确认
- `completed`: 已完成

---

## 6. 更新联系记录状态（管理后台）

**PUT** `/api/admin/contacts/:id`

更新指定联系记录的状态

**URL参数**:
- `id`: 记录ID

**请求参数**:
```json
{
  "status": "processed"  // 新状态
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "id": "1705312200000",
    "status": "processed",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

## 7. 更新预约记录状态（管理后台）

**PUT** `/api/admin/appointments/:id`

更新指定预约记录的状态

**URL参数**:
- `id`: 记录ID

**请求参数**:
```json
{
  "status": "contacted"  // 新状态
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "id": "1705312200000",
    "status": "contacted",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

## 错误码说明

- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误

## 注意事项

1. 所有时间字段使用ISO 8601格式（UTC时间）
2. 手机号验证规则：11位数字，以1开头，第二位为3-9
3. 管理后台API建议添加身份验证（当前版本未实现）

