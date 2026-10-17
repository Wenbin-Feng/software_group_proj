// Prepared teaching examples, not generated content or real client case studies.
window.ReviewRoomStudyData = [
  {
    id: "coupling",
    term: "Low coupling",
    name: "低耦合",
    hint: "改一處，唔使處處改",
    definition: "低耦合，就是減少模組之間不必要的依賴。一個模組的內部做法改了，只要對外約定不變，其他模組就不應跟着大改。",
    question: "換一個供應商，會牽動幾多地方？",
    examples: [
      {
        title: "公司報銷系統換電郵供應商",
        situation: "每個報銷頁面都直接使用同一家電郵供應商的 API。公司一換供應商，多個頁面都要修改及重新測試。",
        action: "把寄信細節集中到通知模組，報銷頁面只呼叫「通知申請人」。換供應商時，主要調整通知模組，並檢查對外行為仍然一致。",
        mapping: "報銷流程只依賴穩定的通知介面，而不是供應商細節。這就是用清晰邊界降低耦合。"
      },
      {
        title: "公司內部 Dashboard 換資料來源",
        situation: "每個圖表都自行讀取舊 ERP 的欄位。新 ERP 改了欄位名稱，各個圖表便要逐一重寫。",
        action: "在資料層統一轉換成約定格式，例如「月份、部門、金額」。圖表只讀取該格式，資料來源轉換由資料層處理。",
        mapping: "圖表依賴共同資料格式，不直接依賴 ERP 的內部格式。減少變更向外擴散，就是低耦合的價值。"
      }
    ],
    takeaway: "少依賴內部細節，多依賴清晰而穩定的介面。",
    caveat: "低耦合不是完全沒有依賴；介面或行為改動仍可能影響其他模組，亦仍然需要測試。",
    scenario: "pr-review",
    practice: "練習：解釋一次程式改動的風險",
    reference: { title: "Microsoft · Architectural principles", url: "https://learn.microsoft.com/dotnet/standard/modern-web-apps-azure-architecture/architectural-principles" }
  },
  {
    id: "change",
    term: "Requirements change",
    name: "需求變更",
    hint: "加功能之前，先講清楚取捨",
    definition: "需求變更，是原先約定的功能或條件有了改動。重點不是一律拒絕，而是先理解原因、評估影響，再一起調整範圍、次序或時間。",
    question: "主管話「順便加埋」，你會先問甚麼？",
    examples: [
      {
        title: "報表上線前，主管想加 Excel 匯出",
        situation: "原定星期五交付網頁報表。星期三主管提出加 Excel 匯出，但團隊仍要完成權限及數據核對。",
        action: "先問匯出是為了哪個工作需要，再估算開發、權限和測試影響。提出兩個選擇：先交核心報表、下次再加匯出；或協議調整今次範圍及交付安排。",
        mapping: "把新增要求變成可討論的影響及選項，而不是默默加班承諾全部完成。這是在管理需求變更。"
      },
      {
        title: "客戶臨時要求增加一級審批",
        situation: "採購系統本來只需部門主管批核，客戶在示範後提出大額採購還要財務主管批准。",
        action: "確認金額門檻、例外及誰有權批核，再檢查流程、通知和測試的改動。把新要求記錄下來，與負責人確認優先次序及本次交付範圍。",
        mapping: "新增一個按鈕背後可能涉及整條流程。先分析及協商影響，再更新約定，才是有管理的變更。"
      }
    ],
    takeaway: "先問目的 → 評估影響 → 提出選項 → 確認新約定。",
    caveat: "這是一般項目例子。在 Scrum 中，Sprint 內的範圍可由 Developers 與 Product Owner 協商，但不應危及 Sprint Goal。",
    scenario: "sprint-scope",
    practice: "練習：討論今次 Sprint 做幾多",
    reference: { title: "The Scrum Guide · The Sprint", url: "https://scrumguides.org/scrum-guide.html#the-sprint" }
  },
  {
    id: "acceptance",
    term: "Acceptance criteria",
    name: "驗收準則",
    hint: "把「做好啲」變成可檢查的條件",
    definition: "驗收準則，是針對某項功能事先約定、可以檢查的條件。它幫助提出需求、開發及測試的人，對「這項功能做到甚麼才算符合要求」有一致理解。",
    question: "「個功能做好咗」——點樣證明？",
    examples: [
      {
        title: "公司報銷表單：唔好只寫「好用」",
        situation: "需求只寫「同事可以提交報銷」。開發者覺得能按提交就完成，但財務部收到很多沒有收據的申請。",
        action: "約定三個可檢查條件：金額大於零且已附收據才可提交；缺少收據時顯示提示且不建立申請；成功提交後顯示申請編號及待審批狀態。",
        mapping: "每個條件都可用一次實際操作檢查，不再靠「應該差不多」判斷。這就是驗收準則。"
      },
      {
        title: "項目文件下載：邊個可以睇？",
        situation: "客戶要求「讓同事下載項目報告」。如果沒有寫清楚權限，其他部門的人可能也能下載。",
        action: "約定：獲授權的項目成員可下載指定報告；未獲授權的使用者即使有直接連結，也不能取得檔案；被拒絕時顯示清楚的權限提示。",
        mapping: "把正常情況和拒絕情況都寫成可驗證結果，讓開發及驗收採用同一組標準。"
      }
    ],
    takeaway: "寫清楚條件及可觀察結果，讓另一個人也能驗證。",
    caveat: "驗收準則針對個別功能；Definition of Done 則是產品增量共同的品質標準，兩者不能互相取代。",
    scenario: "pr-review",
    practice: "練習：用具體行為解釋風險",
    reference: { title: "Scrum Alliance · Acceptance criteria", url: "https://resources.scrumalliance.org/Article/need-know-acceptance-criteria" }
  }
];
