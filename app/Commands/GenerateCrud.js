'use strict'
const Database = use('Database')
const Command = use('Command')
const File = use('File')
const ucfirst = use('ucfirst')
const inflect = use('i')()
class GenerateCrud extends Command {

  get signature() {
    return 'generate-crud {table}'
  }

  get description() {
    return 'Gera um crud a partir de uma tabela'
  }

  * handle(args, options) {
    const coluns = yield Database.table(args.table).columnInfo()
    const primary = Object.keys(coluns)[0]
    const fields = Object.keys(coluns)
    const table = inflect.singularize(args.table)
    yield this.generateModel(table, primary, fields)
    yield this.generateController(table, primary)
    yield this.updateRoutes(table, primary)
    Database.close('mysql')
  }

  * generateModel(table, primaryKey, fields) {
    String.prototype.replaceAll = function (find, replace) {
      let str = this
      return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace)
    }
    const arq = yield File.connection('protected').get('template_files/template_model')
     const user_reserved = yield File.connection('protected').get('template_files/user_reserved')
    const newFile = arq
      .replaceAll('[MODEL]', ucfirst(table))
      .replaceAll('[TABLE]', inflect.pluralize(table))
      .replaceAll('[PRIMARY]', primaryKey)
      .replaceAll('[RULES]', yield this.generateRules(fields))
      .replaceAll('[USER_RESERVED]',table=="user" ? user_reserved : '')
      .replaceAll('[FUNCTIONS]', yield this.generateRefer(fields))
      
    yield File.connection('app').put('Model/' + ucfirst(table) + '.js', newFile)
    this.info('Model Created')
  }

  * generateController(table, primary) {
    String.prototype.replaceAll = function (find, replace) {
      let str = this
      return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace)
    }
    const arq = yield File.connection('protected').get('template_files/template_controller')
    const newFile = arq
      .replaceAll('[CONTROLLER]', ucfirst(table))
      .replaceAll('[MODEL]', ucfirst(table))
      .replaceAll('[TABLE]', table)
      .replaceAll('[PRIMARY]', primary)
    yield File.connection('app').put('Http/Controllers/' + ucfirst(table) + 'Controller.js', newFile)
    this.info('Controller Created')
  }

  * generateRules(fields) {
    let rules = ""
    for (let i = 1; i < fields.length; i++) {
      if (fields[i] == "created_at" || fields[i] == "updated_at" || fields[i] == "inactivated_at" || fields[i] == "deleted_at") {
        continue
      }
      let virgula = fields.length - 2 < i ? "" : ",\n"
      rules += "        " + fields[i] + ":'required'" + virgula
    }
    return rules
  }

  * generateRefer(fields) {
    const arq = yield File.connection('protected').get('template_files/relation_belongsto')
    let functions = ""
    for (let i = 1; i < fields.length; i++) {
      if (fields[i].split('_').reverse()[0] == "id") {
        let table = fields[i].replace('_id', '')
        let iarq = arq
        iarq = iarq.replace('[table]', inflect.camelize(table)).replace('[table_]', table)
        functions += "\n" + iarq
      }
    }
    return functions
  }

  * updateRoutes(table, primaryKey) {
    let otherContent = yield File.connection('app').get('Http/routes.js')
    const routes = yield File.connection('app').put(
      'Http/routes.js',
      otherContent +
      "\nRoute.get('/" + table + "','" + ucfirst(table) + "Controller.index')" +
      "\nRoute.post('/" + table + "/','" + ucfirst(table) + "Controller.store')" +
      "\nRoute.put('/" + table + "/:" + primaryKey + "','" + ucfirst(table) + "Controller.update')" +
      "\nRoute.delete('/" + table + "/:" + primaryKey + "','" + ucfirst(table) + "Controller.destroy')"
    )
    this.info('Routes Created')
  }

}
module.exports = GenerateCrud
