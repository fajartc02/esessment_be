const table = require("../../config/table")
const {
    queryPOST,
    queryBulkPOST,
    queryCustom,
    queryGET,
    queryPUT,
    queryTransaction,
    queryPutTransaction
} = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")

module.exports = {
    getItemCheckKanban4sByKanbanId: async (req, res) => {
        try {
            const itemCheckSql = `
                select distinct
                    on (
                        tbrcs.freq_id,
                        tbrcs.zone_id,
                        tbrcs.kanban_id,
                        tmic.item_check_kanban_id
                    ) tbrcs.sub_schedule_id,
                    tbrcs.kanban_id,
                    tmic.item_check_kanban_id,
                    tmic.item_check_nm,
                    tmk.kanban_no
                from
                    tb_r_4s_sub_schedules tbrcs
                    join tb_m_4s_item_check_kanbans tmic on tbrcs.kanban_id = tmic.kanban_id
                    join tb_m_kanbans tmk on tmic.kanban_id = tmk.kanban_id
                where
                    tbrcs.main_schedule_id = 1
            `
        } catch (error) {
            
        }  
    },
    editItemCheckKanban4s: async (req, res) => { 
        
    }
}