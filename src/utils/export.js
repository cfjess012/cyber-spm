import * as XLSX from 'xlsx'

export function exportToExcel(objects, filename = 'OneList_Export.xlsx') {
  const rows = objects.map((obj) => ({
    'List Name': obj.listName,
    'Product Families': (obj.productFamilies || []).join('; '),
    Type: obj.type,
    Criticality: obj.criticality,
    Status: obj.status,
    'Identifying Person': obj.identifyingPerson,
    Owner: obj.owner,
    Operator: obj.operator,
    'Control Classification': obj.controlClassification,
    'NIST 800-53 Family': (obj.nistFamilies || []).join('; '),
    'KPI Numerator': obj.kpiNumerator,
    'KPI Denominator': obj.kpiDenominator,
    'Compliance %': obj.compliancePercent,
    'Control Function': obj.controlType,
    'Implementation Type': obj.implementationType,
    'Execution Frequency': obj.executionFrequency,
    'Review Cadence': obj.reviewCadence,
    'Health Status': obj.healthStatus,
    'Health Rationale': obj.healthRationale,
    Description: obj.description,
    'Last Review Date': obj.lastReviewDate,
    'Next Review Date': obj.nextReviewDate,
    'Jira L1 (Epic)': obj.jiraL1,
    'Jira L2 (Initiative)': obj.jiraL2,
    Environment: obj.environment,
    'Data Classification': obj.dataClassification,
    'Business Unit': obj.businessUnit,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Objects')
  XLSX.writeFile(wb, filename)
}

export function exportToJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `CPM_Backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Fuzzy header matching — maps imported column names to our field names
const HEADER_MAP = {
  'list name': 'listName',
  'name': 'listName',
  'product families': 'productFamilies',
  'product family': 'productFamilies',
  'type': 'type',
  'criticality': 'criticality',
  'status': 'status',
  'identifying person': 'identifyingPerson',
  'identifier': 'identifyingPerson',
  'owner': 'owner',
  'operator': 'operator',
  'control classification': 'controlClassification',
  'control class': 'controlClassification',
  'nist 800-53 family': 'nistFamilies',
  'nist family': 'nistFamilies',
  'nist families': 'nistFamilies',
  'kpi numerator': 'kpiNumerator',
  'numerator': 'kpiNumerator',
  'kpi denominator': 'kpiDenominator',
  'denominator': 'kpiDenominator',
  'compliance %': 'compliancePercent',
  'compliance': 'compliancePercent',
  'control function': 'controlType',
  'control type': 'controlType',
  'implementation type': 'implementationType',
  'implementation': 'implementationType',
  'execution frequency': 'executionFrequency',
  'frequency': 'executionFrequency',
  'review cadence': 'reviewCadence',
  'cadence': 'reviewCadence',
  'health status': 'healthStatus',
  'health': 'healthStatus',
  'health rationale': 'healthRationale',
  'rationale': 'healthRationale',
  'description': 'description',
  'last review date': 'lastReviewDate',
  'last review': 'lastReviewDate',
  'next review date': 'nextReviewDate',
  'next review': 'nextReviewDate',
  'jira l1 (epic)': 'jiraL1',
  'jira l1': 'jiraL1',
  'epic': 'jiraL1',
  'jira l2 (initiative)': 'jiraL2',
  'jira l2': 'jiraL2',
  'initiative': 'jiraL2',
  'environment': 'environment',
  'data classification': 'dataClassification',
  'data class': 'dataClassification',
  'business unit': 'businessUnit',
}

function fuzzyMatch(header) {
  const key = header.toLowerCase().trim()
  return HEADER_MAP[key] || null
}

export function importFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const objects = raw.map((row) => {
          const obj = {}
          for (const [header, value] of Object.entries(row)) {
            const field = fuzzyMatch(header)
            if (field) {
              if (field === 'productFamilies' || field === 'nistFamilies') {
                obj[field] = String(value).split(/[;,]/).map((s) => s.trim()).filter(Boolean)
              } else if (field === 'kpiNumerator' || field === 'kpiDenominator' || field === 'compliancePercent') {
                obj[field] = Number(value) || 0
              } else {
                obj[field] = String(value)
              }
            }
          }
          return obj
        })

        resolve(objects)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
