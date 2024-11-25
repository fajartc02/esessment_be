const {mapWhereCond, queryCustom} = require("../helpers/query");

const sql = {
    leftJoinLateralLast(alias, {isCount = false, optionalAlias = 'trh4sick'} = {}){
        return `left join lateral (
                    select 
                        ${isCount ? 'count(*)::real as total_history' : '*'}  
                    from 
                        tb_r_history_4s_item_check_kanbans 
                    where 
                        item_check_kanban_id = ${alias}.item_check_kanban_id 
                    ${isCount ? '' : 'order by created_dt desc limit 1'}
                 ) ${optionalAlias} on true`;
    },
    find(
        {
            isCount = false,
            isSingle = false,
            item_check_kanban_id = null,
            item_check_kanban_uuid = null,
        } = {}
    ) {
        const baseSelect = `tmk.uuid                              as kanban_id,
                                     tm4sick.uuid                          as item_check_kanban_id,
                                     tm4sick.item_check_nm,
                                     tmk.kanban_no,
                                     trh4sick.history_item_check_kanban_id as before_history_item_check_kanban_id,
                                     trh4sick.item_check_nm                as before_item_check_nm,
                                     trh4sick.standart_time                as before_standart_time,
                                     trh4sick.method                       as before_method,
                                     trh4sick.control_point                as before_control_point,
                                     trh4sick.ilustration_imgs             as before_ilustration_imgs,
                                     trh4sick.note                         as before_note,
                                     trh4sick.is_new                       as before_is_new,
                                     trh4sick.is_update                    as before_is_update,
                                     trh4sick.is_delete                    as before_is_delete,
                                     trh4sick.created_by                   as history_created_by,
                                     trh4sick.created_dt                   as history_created_dt`;
        const clause = mapWhereCond({
            item_check_kanban_id: item_check_kanban_id ? item_check_kanban_id : item_check_kanban_uuid,
        });

        return `select
                     ${isCount ? 'count(*) as total' : baseSelect}
                 from
                     tb_r_history_4s_item_check_kanbans trh4sick
                         join public.tb_m_4s_item_check_kanbans tm4sick on trh4sick.item_check_kanban_id = tm4sick.item_check_kanban_id
                         join public.tb_m_kanbans tmk on tm4sick.kanban_id = tmk.kanban_id
                 where 
                     1 = 1
                     ${clause ? `and ${clause}` : ''}
                 order by trh4sick.created_dt desc 
                 ${isSingle ? 'limit 1' : ''}`;
    }
};

const query = {
    async findDynamic(
        {
            query,
        } = {}
    ) {
        try {
            const str = sql.find({
                ...query
            });

            const exec = (await queryCustom(str)).rows;
            if (query.isSingle) {
                return exec[0];
            }

            return exec;
        } catch (e) {
            throw e;
        }
    }
};

module.exports = {
    query,
    leftJoinLateralLast: sql.leftJoinLateralLast
};