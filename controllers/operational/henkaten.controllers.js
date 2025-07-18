const table = require("../../config/table");
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const queryCondExacOpAnd = require("../../helpers/conditionsQuery");
const getLastIdData = require("../../helpers/getLastIdData");
const {
  queryPOST,
  queryCustom,
  queryGET,
  queryPUT,
} = require("../../helpers/query");
const response = require("../../helpers/response");
const uuidToId = require("../../helpers/uuidToId");
const condDataNotDeleted = `WHERE henkaten.deleted_dt IS NULL`;

module.exports = {
  addHenkaten: async (req, res) => {
    try {
      let findingData = req.body.findings;
      delete req.body.findings;
      let henkatenObj = req.body;
      let lasthenkatenId =
        (await getLastIdData(table.tb_r_henkaten, "henkaten_id")) + 1;
      henkatenObj.henkaten_id = await lasthenkatenId;
      henkatenObj.uuid = req.uuid();
      henkatenObj.henkaten_pic =
        (await uuidToId(
          table.tb_m_users,
          "user_id",
          henkatenObj.henkaten_pic
        )) ?? null;
      henkatenObj.henkaten_line_id =
        (await uuidToId(
          table.tb_m_lines,
          "line_id",
          henkatenObj.henkaten_line_id
        )) ?? null;
      let attrsUserCreated = await attrsUserInsertData(req, henkatenObj);
      console.log(attrsUserCreated);
      let henkatenData = await queryPOST(table.tb_r_henkaten, attrsUserCreated);

      let lastFindingId =
        (await getLastIdData(table.tb_r_findings, "finding_id")) + 1;
      findingData.category_id =
        findingData.category_id != "" && findingData.category_id
          ? (await uuidToId(
              table.tb_m_categories,
              "category_id",
              findingData.category_id
            )) ?? null
          : null;
      findingData.cm_pic_id =
        (await uuidToId(table.tb_m_users, "user_id", findingData.cm_pic_id)) ??
        null;
      findingData.factor_id =
        (await uuidToId(
          table.tb_m_factors,
          "factor_id",
          findingData.factor_id
        )) ?? null;
      findingData.line_id =
        (await uuidToId(table.tb_m_lines, "line_id", findingData.line_id)) ??
        null;
      findingData.cm_result_factor_id =
        (await uuidToId(
          table.tb_m_factors,
          "factor_id",
          findingData.cm_result_factor_id
        )) ?? null;
      let objFinding = {
        finding_id: lastFindingId,
        uuid: req.uuid(),
        finding_henkaten_id: henkatenData.rows[0].henkaten_id,
        ...findingData,
      };
      let attrsUserInsertFinding = await attrsUserInsertData(req, objFinding);
      await queryPOST(table.tb_r_findings, attrsUserInsertFinding);
      response.success(res, "Success to POST Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to POST Henkaten");
    }
  },
  getHenkaten: async (req, res) => {
    try {
      let { start_date, end_date, line_id, limit, currentPage } = req.query;
      req.query["henkaten.henkaten_line_id"] =
        line_id != -1 && line_id
          ? `${await uuidToId(table.tb_m_lines, "line_id", line_id)}`
          : null;
      delete req.query.line_id;
      let conditions =
        " AND " + queryCondExacOpAnd(req.query, "henkaten.created_dt");
      let qLimit = ``;
      let qOffset =
        limit != -1 && limit && currentPage > 1
          ? `OFFSET ${limit * (currentPage - 1)}`
          : ``;
      if (limit != -1 && limit) qLimit = `LIMIT ${limit}`;
      console.log(conditions);
      let q = `
            select 
                henkaten.*,
                henkaten.uuid as henkaten_id,
                tmu.uuid as henkaten_pic,
                tmu.noreg || '-' || tmu.fullname as henkaten_pic_nm,
                tml.line_nm,
                tml.uuid as henkaten_line_id
            from tb_r_henkaten henkaten 
            join tb_m_lines tml 
                on tml.line_id  = henkaten.henkaten_line_id
            join tb_m_users tmu
                on tmu.user_id = henkaten.henkaten_pic
            ${condDataNotDeleted}
            ${conditions} ${qLimit} ${qOffset}`;

      const queryhenkaten = await queryCustom(q);
      const HenkatenData = queryhenkaten.rows;
      const henkatenFindingsData = HenkatenData.map(async (henkaten) => {
        henkaten.findings = await queryGET(
          table.v_finding_list,
          `WHERE finding_henkaten_id = '${henkaten.uuid}' ORDER BY finding_date DESC`
        );
        return henkaten;
      });
      const waithenkatenFindings = await Promise.all(henkatenFindingsData);
      let qCountTotal = `SELECT 
            count(henkaten.henkaten_id) as total_page
            from tb_r_henkaten henkaten 
            join tb_m_lines tml 
                on tml.line_id  = henkaten.henkaten_line_id
            join tb_m_users tmu
                on tmu.user_id = henkaten.henkaten_pic
        ${condDataNotDeleted}
        ${conditions}`;
      let total_page = await queryCustom(qCountTotal);
      let totalPage = await total_page.rows[0].total_page;
      if (HenkatenData.length > 0) {
        HenkatenData[0].total_page =
          +totalPage > 0 ? Math.ceil(totalPage / +limit) : 1;
        HenkatenData[0].limit = +limit;
        HenkatenData[0].total_data = +totalPage;
        HenkatenData[0].current_page = +currentPage > 0 ? +currentPage : 1;
      }
      response.success(res, "Success to GET Henkaten", waithenkatenFindings);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to GET Henkaten");
    }
  },
  deleteHenkaten: async (req, res) => {
    try {
      let henkaten_id = await uuidToId(
        table.tb_r_henkaten,
        "henkaten_id",
        req.params.id
      );
      let obj = {
        deleted_dt: "CURRENT_TIMESTAMP",
        deleted_by: req.user.fullname,
      };
      await queryPUT(
        table.tb_r_findings,
        obj,
        `WHERE finding_henkaten_id = '${henkaten_id}'`
      );
      await queryPUT(
        table.tb_r_henkaten,
        obj,
        `WHERE henkaten_id = '${henkaten_id}'`
      );
      response.success(res, "Success to DELETE Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to DELETE Henkaten");
    }
  },
  editHenkaten: async (req, res) => {
    try {
      let findingsData = {
        ...req.body.findings,
        line_id: await uuidToId(
          table.tb_m_lines,
          "line_id",
          req.body.findings.line_id
        ),
        category_id:
          req.body.findings.category_id != "" && req.body.findings.category_id
            ? await uuidToId(
                table.tb_m_categories,
                "category_id",
                req.body.findings.category_id
              )
            : null,
        factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.factor_id
        ),
        cm_pic_id: await uuidToId(
          table.tb_m_users,
          "user_id",
          req.body.findings.cm_pic_id
        ),
        cm_result_factor_id: await uuidToId(
          table.tb_m_factors,
          "factor_id",
          req.body.findings.cm_result_factor_id
        ),
      };

      delete req.body.findings;

      req.body.henkaten_line_id = await uuidToId(
        table.tb_m_lines,
        "line_id",
        req.body.henkaten_line_id
      );
      req.body.henkaten_pic = await uuidToId(
        table.tb_m_users,
        "user_id",
        req.body.henkaten_pic
      );

      let attrsUpdateUserFt = await attrsUserUpdateData(req, req.body);
      let attrsUpdateUserFinding = await attrsUserUpdateData(req, findingsData);

      let henkaten_id = await uuidToId(
        table.tb_r_henkaten,
        "henkaten_id",
        req.params.id
      );

      await queryPUT(
        table.tb_r_findings,
        attrsUpdateUserFinding,
        `WHERE finding_henkaten_id = '${henkaten_id}'`
      );
      await queryPUT(
        table.tb_r_henkaten,
        attrsUpdateUserFt,
        `WHERE henkaten_id = '${henkaten_id}'`
      );
      response.success(res, "Success to EDIT Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to EDIT Henkaten");
    }
  },
  editScoreHenkanten: async (req, res) => {
    try {
      let HkId = await uuidToId(
        table.tb_r_henkaten,
        "henkaten_id",
        req.params.id
      );
      const scoreUpdate = {
        score: req.body.score,
      };
      let attrsUpdateUserHK = await attrsUserUpdateData(req, scoreUpdate);

      await queryPUT(
        table.tb_r_henkaten,
        attrsUpdateUserHK,
        `WHERE henkaten_id = '${HkId}'`
      );

      response.success(res, "Success to EDIT Score of Henkaten");
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to edit score of Henkaten");
    }
  },
};
