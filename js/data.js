/* ============================================================
   data.js — 原型 mock 数据（模拟后端返回）
   ============================================================ */

const DATA = {

  /* ---------- 知识点（软件工程课程） ---------- */
  topics: [
    { id: 'req',     name: '需求工程',        icon: '📋', desc: '需求获取、分析与规约',        mastery: 32, attempts: 6,  errors: 2 },
    { id: 'design',  name: '软件设计与架构',  icon: '🏛️', desc: '模块化、设计模式与架构风格',  mastery: 56, attempts: 9,  errors: 1 },
    { id: 'git',     name: '版本控制 Git',    icon: '🌿', desc: '分支策略、协作与冲突处理',    mastery: 78, attempts: 14, errors: 0 },
    { id: 'test',    name: '软件测试',        icon: '🧪', desc: '测试层级、覆盖率与 TDD',      mastery: 41, attempts: 8,  errors: 3 },
    { id: 'agile',   name: '敏捷与项目管理',  icon: '🔄', desc: 'Scrum、看板与迭代规划',      mastery: 63, attempts: 7,  errors: 1 },
    { id: 'quality', name: '代码质量与重构',  icon: '✨', desc: '坏味道、重构手法与评审',      mastery: 27, attempts: 5,  errors: 2 },
    { id: 'cicd',    name: 'CI/CD 与 DevOps', icon: '🚀', desc: '流水线、自动化与部署策略',    mastery: 49, attempts: 6,  errors: 1 },
    { id: 'agent',   name: 'AI Agent 编排',   icon: '🤖', desc: '工具调用、工作流与状态机',    mastery: 36, attempts: 4,  errors: 2 },
  ],

  /* ---------- 学习活动类型（学生端只有 3 种） ---------- */
  activities: {
    explain:  { id: 'explain',  name: '知识点讲解', icon: '🎧', ability: '理解概念', desc: '基于教师发布资料的分页讲解，可随时提问' },
    practice: { id: 'practice', name: '实践练习',   icon: '🎯', ability: '练习 + 编程', desc: '先做针对性练习，再完成一个编程实践任务' },
    review:   { id: 'review',   name: '知识复习',   icon: '🔁', ability: '巩固纠错', desc: '针对历史错误的闪卡回顾' },
  },

  /* ---------- 练习题库（practice） ---------- */
  practice: {
    req: [
      { q: '下列哪项属于「非功能性需求」？', opts: ['用户登录后可查看订单', '系统在 2 秒内响应 95% 的请求', '管理员可导出报表', '用户可修改密码'], a: 1,
        why: '非功能性需求描述系统的质量属性（性能、可用性、安全性），而非具体功能行为。' },
      { q: '需求评审最主要的目的？', opts: ['确定项目预算', '尽早发现需求中的歧义与遗漏', '分配开发任务', '编写测试用例'], a: 1,
        why: '需求评审核心价值在于「早期发现」——修复需求缺陷的成本远低于上线后修复。' },
    ],
    design: [
      { q: '「依赖倒置原则」强调？', opts: ['高层模块依赖低层模块', '抽象不应依赖细节，细节应依赖抽象', '类之间应尽量减少通信', '优先使用继承而非组合'], a: 1,
        why: 'DIP：高层与低层都应依赖抽象，抽象不依赖细节，细节依赖抽象，从而降低耦合。' },
      { q: '微服务架构最主要的代价是？', opts: ['开发语言受限', '分布式系统带来的运维与一致性复杂度', '无法水平扩展', '代码复用率低'], a: 1,
        why: '微服务换来自治与弹性，但引入了网络、数据一致性、可观测性等分布式复杂度。' },
    ],
    git: [
      { q: 'git rebase 与 git merge 的关键区别？', opts: ['rebase 会改写提交历史，merge 保留分支结构', 'merge 会改写历史', '两者完全等价', 'rebase 只能用于远程分支'], a: 0,
        why: 'rebase 将提交「重放」到目标分支上，产生线性历史但改写 commit；merge 保留完整分支拓扑。' },
      { q: '团队协作中推荐的主干分支策略是？', opts: ['所有开发直接 push 到 main', '长期特性分支不合并', '短生命周期特性分支 + PR 评审后合并', '每人一个永久分支'], a: 2,
        why: '短分支 + Pull Request 评审能兼顾集成频率与代码质量，减少集成地狱。' },
    ],
    test: [
      { q: '测试金字塔主张？', opts: ['UI 测试最多，单元测试最少', '单元测试最多且最快，端到端测试少量', '只做手工测试', '三种测试数量相同'], a: 1,
        why: '大量快速的单元测试打底，少量慢速的端到端测试覆盖关键链路，兼顾速度与信心。' },
      { q: '「变异测试」主要用于衡量？', opts: ['代码执行速度', '测试用例发现缺陷的能力', 'UI 覆盖率', '内存占用'], a: 1,
        why: '变异测试通过注入缺陷检验测试能否「杀死」变异体，评估测试套件有效性而非仅看覆盖率。' },
    ],
    agile: [
      { q: 'Sprint 评审会（Review）的主要产出？', opts: ['下一轮 Sprint 的详细任务分配', '增量交付物与干系人反馈', '团队绩效考核', '技术架构文档'], a: 1,
        why: 'Review 聚焦「做了什么 + 拿到反馈」，任务分配属于 Sprint 计划会。' },
      { q: '看板（Kanban）与 Scrum 的显著差异？', opts: ['Kanban 无时间盒迭代，强调限制在制品（WIP）', 'Kanban 必须有 Sprint', 'Scrum 不需要角色', '两者完全相同'], a: 0,
        why: 'Kanban 是流式方法，通过 WIP 限制暴露瓶颈；Scrum 以固定时间盒迭代组织工作。' },
    ],
    quality: [
      { q: '下列哪项是典型的「代码坏味道」？', opts: ['函数命名清晰', '过长的方法（Long Method）', '单一职责的类', '有意义的注释'], a: 1,
        why: 'Long Method、God Class、重复代码等都属于坏味道，是重构的信号。' },
      { q: '重构的前提条件是？', opts: ['有完善的自动化测试保护', '必须先重写整个模块', '只能在发布前进行', '必须修改外部行为'], a: 0,
        why: '重构不改变外部行为，需要测试作为安全网来验证行为未被破坏。' },
    ],
    cicd: [
      { q: '「持续交付」与「持续部署」的区别？', opts: ['两者无区别', '持续交付保证可随时发布但由人工触发，持续部署自动发布到生产', '持续部署不需要测试', '持续交付是手动流程'], a: 1,
        why: 'CD 有两层含义：Continuous Delivery（可发布）与 Continuous Deployment（自动发布）。' },
      { q: '蓝绿部署的核心收益？', opts: ['降低存储成本', '快速回滚与零停机发布', '减少代码量', '提升单元测试速度'], a: 1,
        why: '通过切换流量在两个环境间切换，实现近乎零停机与秒级回滚。' },
    ],
    agent: [
      { q: '在 Agent 编排中，「Re-planning」的作用是？', opts: ['重新训练模型', '根据环境反馈更新状态并修正后续计划', '清空对话历史', '提高模型温度'], a: 1,
        why: 'Re-planning 让 Agent 依据观察结果动态调整策略，是闭环自适应的关键。' },
      { q: '给 LLM 提供工具（Tools）主要为了解决？', opts: ['降低推理成本', '突破模型静态知识限制，执行真实动作', '减少 token 消耗', '提高生成随机性'], a: 1,
        why: '工具调用让 Agent 能检索、计算、执行外部动作，弥合「会说」与「能做」的鸿沟。' },
    ],
  },

  /* ---------- 挑战题库（challenge） ---------- */
  challenge: {
    req:     { q: '客户说「我要一个更好用的后台」。最合适的下一步是？', opts: ['立即开始设计数据库', '追问使用场景与痛点，把模糊表述转成可验证的验收标准', '按行业通用模板直接开发', '让客户自己写需求文档'], a: 1, why: '模糊需求要先通过追问澄清，并转化为可验证的验收准则（Acceptance Criteria）。' },
    design:  { q: '系统需要在「强一致性」与「高可用」间取舍，这体现？', opts: ['CAP 定理', '康威定律', '奥卡姆剃刀', '二八法则'], a: 0, why: 'CAP 指出分区容错下一致性与可用性不可兼得，架构设计必须显式取舍。' },
    git:     { q: '多人同时改同一文件产生冲突，正确做法是？', opts: ['直接删除对方代码', '沟通后手动合并并运行测试验证', '强制 push 覆盖', '丢弃自己的改动重新拉取'], a: 1, why: '冲突需人工判读语义，合并后必须跑测试确认行为正确。' },
    test:    { q: '某个测试「时好时坏」（flaky），首要处理方式是？', opts: ['重跑直到通过', '定位不稳定性根因（异步等待/共享状态/时间依赖）并修复或隔离', '直接删除该测试', '给它加长 sleep'], a: 1, why: 'Flaky 测试破坏信任，应定位根因；加 sleep 只是掩盖问题。' },
    agile:   { q: '团队连续三个 Sprint 都无法完成承诺，最先应？', opts: ['延长工作时间', '在回顾会分析根因并下调承诺量、拆分需求', '取消回顾会', '换掉 Scrum Master'], a: 1, why: '回顾会的价值是改进流程；承诺应基于真实速率（velocity）而非期望。' },
    quality: { q: '代码评审中最有价值的关注点是？', opts: ['括号风格与缩进', '设计合理性、边界与错误处理、可维护性', '变量命名长度', '注释数量'], a: 1, why: '风格交给格式化工具；人应聚焦设计、正确性与可维护性。' },
    cicd:    { q: '流水线中「质量门禁（Quality Gate）」应放在？', opts: ['只在发布后', '合并前（PR 阶段），阻断不达标变更进入主干', '仅在本地', '每月一次'], a: 1, why: '门禁左移到合并前，才能低成本阻断缺陷。' },
    agent:   { q: 'Agent 陷入无限循环调用同一工具，最有效的约束是？', opts: ['降低 temperature', '设置最大步数、成本预算与终止条件', '换更大的模型', '清空记忆'], a: 1, why: '需在编排层显式设定终止条件与预算，防止失控与成本爆炸。' },
  },

  /* ---------- 讲解内容（explain，每知识点 3 页） ---------- */
  explain: {
    req: [
      { t: '需求的层次', items: ['<b>业务需求</b>：组织为什么要做这件事（目标、价值）', '<b>用户需求</b>：用户希望完成什么任务', '<b>功能需求</b>：系统必须提供的具体行为'],
        tip: '从「为什么」到「做什么」再到「怎么做」，逐层收敛，避免过早陷入实现细节。' },
      { t: '功能性 vs 非功能性', items: ['<b>功能性</b>：系统「做什么」——登录、下单、导出', '<b>非功能性</b>：系统「做得多好」——性能、可用性、安全、可维护'],
        tip: '非功能性需求常被忽略，却是架构决策的主要驱动因素。' },
      { t: '好需求的标准', items: ['<b>可验证</b>：能写出明确的验收条件', '<b>无歧义</b>：不同人读到的含义一致', '<b>可追溯</b>：能回溯到来源与后续设计'],
        tip: '一条需求写完后问自己：测试同学能据此判断通过与否吗？' },
    ],
    design: [
      { t: 'SOLID 中的 DIP', items: ['高层模块不应依赖低层模块，二者都应依赖<b>抽象</b>', '抽象不应依赖细节，细节应依赖抽象', '实践方式：面向接口编程 + 依赖注入'],
        tip: '依赖倒置是插件化架构与可测试性的基础。' },
      { t: '架构风格选型', items: ['<b>单体</b>：简单、部署容易，适合早期与小型团队', '<b>微服务</b>：自治性强、可独立扩展，但带来分布式复杂度', '<b>事件驱动</b>：松耦合、高弹性，调试与一致性更难'],
        tip: '没有最好的架构，只有最契合当前约束的架构。' },
      { t: '耦合与内聚', items: ['追求<b>高内聚</b>：模块内部元素围绕同一职责', '追求<b>低耦合</b>：模块间依赖尽量少且稳定', '衡量方法：改动一个类，需要连带改多少处？'],
        tip: '「改一处动全身」就是耦合过高的信号。' },
    ],
    git: [
      { t: '三个区域', items: ['<b>工作区</b>：你正在编辑的文件', '<b>暂存区（Index）</b>：git add 后待提交的内容', '<b>版本库</b>：git commit 后的历史快照'],
        tip: '理解三区，`reset` / `checkout` / `restore` 的区别就迎刃而解。' },
      { t: 'merge vs rebase', items: ['<b>merge</b>：保留分支拓扑，产生合并提交，历史真实', '<b>rebase</b>：重放提交，历史线性整洁，但<b>改写历史</b>'],
        tip: '经验法则：已推送到公共分支的提交不要 rebase。' },
      { t: '协作最佳实践', items: ['短生命周期特性分支', 'Pull Request + 至少一人评审', '提交信息说明「为什么」而非「改了什么」'],
        tip: '小而频繁的集成，远优于大而罕见的合并。' },
    ],
    test: [
      { t: '测试金字塔', items: ['底层：<b>单元测试</b>——多、快、稳定', '中层：<b>集成测试</b>——验证模块间协作', '顶层：<b>E2E 测试</b>——少量覆盖关键链路'],
        tip: '倒金字塔（重 UI 轻单测）是测试套件腐化的典型征兆。' },
      { t: '覆盖率不是银弹', items: ['覆盖率衡量「哪些代码被执行」，不等于「验证是否正确」', '高覆盖 + 弱断言 = 虚假的安全感', '可结合<b>变异测试</b>评估断言强度'],
        tip: '问「这个测试能抓住什么样的 bug」，比问「覆盖率多少」更有意义。' },
      { t: 'TDD 的节奏', items: ['<b>Red</b>：先写一个失败的测试', '<b>Green</b>：用最简实现让它通过', '<b>Refactor</b>：在测试保护下重构'],
        tip: 'TDD 的价值不在测试本身，而在驱动出可测试的设计。' },
    ],
    agile: [
      { t: 'Scrum 的三个角色', items: ['<b>Product Owner</b>：对价值负责，管理 Backlog', '<b>Scrum Master</b>：保障流程，移除障碍', '<b>Developers</b>：自组织交付增量'],
        tip: '角色是「责任」而非「职级」。' },
      { t: '五个事件', items: ['Sprint 计划会：定目标与承诺', '每日站会：同步进展与障碍', 'Sprint 评审：演示增量并收集反馈', 'Sprint 回顾：改进团队流程'],
        tip: '「Sprint」本身是容器，四个会议构成反馈闭环。' },
      { t: '看板的核心机制', items: ['<b>可视化</b>工作流', '<b>限制在制品（WIP）</b>暴露瓶颈', '度量<b>交付周期</b>与流动效率'],
        tip: 'WIP 限制是看板最容易被忽略却最有效的杠杆。' },
    ],
    quality: [
      { t: '识别坏味道', items: ['<b>Long Method</b>：方法过长，职责混杂', '<b>God Class</b>：一个类做了所有事', '<b>Duplicated Code</b>：重复逻辑散落多处'],
        tip: '坏味道不是错误，是「值得重构」的信号。' },
      { t: '常用重构手法', items: ['<b>Extract Method</b>：把片段提成有意义的方法', '<b>Rename</b>：让名字承载意图', '<b>Replace Conditional with Polymorphism</b>：消除分支堆叠'],
        tip: '小步重构 + 每步跑测试，是安全重构的节奏。' },
      { t: '代码评审的关注点', items: ['设计是否合理、职责是否清晰', '边界条件与错误处理是否完备', '是否存在安全与性能隐患'],
        tip: '把格式化交给工具，把脑力留给设计。' },
    ],
    cicd: [
      { t: 'CI 与 CD', items: ['<b>持续集成</b>：频繁合并到主干并自动构建测试', '<b>持续交付</b>：主干始终处于可发布状态', '<b>持续部署</b>：通过验证后自动发布生产'],
        tip: 'CI 的目的是「尽早暴露集成问题」。' },
      { t: '流水线的典型阶段', items: ['构建 → 静态检查 → 单元测试 → 集成测试 → 打包 → 部署 → 冒烟验证'],
        tip: '越便宜、越快的检查越要放在前面（fail fast）。' },
      { t: '部署策略', items: ['<b>蓝绿部署</b>：双环境切换，秒级回滚', '<b>金丝雀发布</b>：小比例灰度，观察后放量', '<b>特性开关</b>：代码先行部署，功能按需开启'],
        tip: '「部署」与「发布」解耦，是降低发布风险的关键。' },
    ],
    agent: [
      { t: 'Agent 的循环', items: ['<b>Plan</b>：把目标拆解为步骤', '<b>Act</b>：调用工具执行', '<b>Observe</b>：读取环境反馈', '<b>Update & Re-plan</b>：更新状态并修正计划'],
        tip: '与「一问一答」的本质区别：Agent 拥有状态与闭环。' },
      { t: '为什么需要工具', items: ['模型知识是<b>静态</b>的，无法获取实时数据', '模型无法直接执行动作（写文件、调 API）', '工具调用把「会说」变成「会做」'],
        tip: '工具定义要像 API 文档一样清晰：名称、参数、用途、返回。' },
      { t: '可控性设计', items: ['<b>最大步数</b>与<b>成本预算</b>防止失控', '<b>终止条件</b>显式定义', '关键动作保留<b>人工确认（Human-in-the-loop）</b>'],
        tip: 'Agent 的能力来自模型，可靠性来自编排层的约束。' },
    ],
  },

  /* ---------- 教师发布的学习路径（学生端只读） ---------- */
  published: {
    courseId: 'c1',
    course: '软件工程导论 · SE-3A',
    instructor: 'Dr. Chan',
    updated: '2026-10-20',
    term: '2026 Fall',
    note: '知识点、顺序与配套资料均由教师发布，学生端不可自行增删。',
    order: ['req', 'design', 'test', 'quality', 'agile', 'cicd', 'git', 'agent'],
  },

  /* ---------- 课程资料（教师发布） ---------- */
  materials: [
    { id: 'm1', name: 'Week03_需求工程.pdf',        kind: 'PDF',  size: '2.4 MB', pages: 18, from: '教师发布' },
    { id: 'm2', name: 'Week05_软件设计与架构.pdf',  kind: 'PDF',  size: '3.1 MB', pages: 24, from: '教师发布' },
    { id: 'm3', name: 'Week07_软件测试.pptx',       kind: 'PPT',  size: '5.6 MB', pages: 31, from: '教师发布' },
    { id: 'm4', name: 'Week09_代码质量与重构.pdf',  kind: 'PDF',  size: '1.8 MB', pages: 15, from: '教师发布' },
    { id: 'm5', name: '课程实验指导书.md',          kind: 'MD',   size: '86 KB',  pages: 9,  from: '教师发布' },
  ],

  /* ---------- AI 问答助手（基于资料检索作答） ---------- */
  assistant: {
    welcome: '你好，我是课程 AI 问答助手。我只依据「教师发布的课程资料 + 你自己上传的资料」作答，并给出引用出处，供你自行判断。',
    examples: [
      '非功能性需求包含哪些内容？',
      '测试金字塔是怎么分层的？',
      'rebase 和 merge 有什么区别？',
      '什么样的代码算坏味道？',
      'CI 和 CD 的区别是什么？',
    ],
    kb: [
      { kw: ['非功能', '性能', '可用性', '质量属性', '响应'], topicId: 'req',
        a: '非功能性需求描述系统「做得多好」，即质量属性：性能、可用性、安全性、可维护性等，而不是具体业务行为。例如「系统在 2 秒内响应 95% 的请求」就是非功能性需求。它常被忽略，却是架构决策的主要驱动因素。',
        src: ['Week03_需求工程.pdf · P7–P9'] },
      { kw: ['需求', '验收', '歧义', '评审'], topicId: 'req',
        a: '好需求应当可验证、无歧义、可追溯。一条需求写完后可以自问：测试同学能否据此判断通过与否？需求评审的核心价值是尽早发现歧义与遗漏——修复需求缺陷的成本远低于上线后修复。',
        src: ['Week03_需求工程.pdf · P4–P6'] },
      { kw: ['依赖倒置', 'SOLID', '耦合', '内聚', '微服务', '架构'], topicId: 'design',
        a: '依赖倒置（DIP）：高层与低层都应依赖抽象，抽象不依赖细节。选型上，单体简单、部署容易；微服务自治性强但引入分布式复杂度。判断标准是「当前约束」而非流行度。追求高内聚、低耦合：改一处要连带改多少处，就是耦合度的信号。',
        src: ['Week05_软件设计与架构.pdf · P11–P14'] },
      { kw: ['测试金字塔', '单元测试', '覆盖率', 'TDD', '变异'], topicId: 'test',
        a: '测试金字塔：底层大量快速的单元测试，中层集成测试，顶层少量 E2E 覆盖关键链路。覆盖率只衡量「哪些代码被执行」，不等于验证正确；可结合变异测试评估断言强度。TDD 节奏是 Red → Green → Refactor，其价值在于驱动出可测试的设计。',
        src: ['Week07_软件测试.pptx · P5–P8'] },
      { kw: ['坏味道', '重构', '评审', 'Long Method'], topicId: 'quality',
        a: '典型坏味道包括 Long Method、God Class、Duplicated Code，它们是「值得重构」的信号。重构不改变外部行为，前提是有自动化测试作为安全网。评审应聚焦设计合理性、边界与错误处理、可维护性，把格式化交给工具。',
        src: ['Week09_代码质量与重构.pdf · P3–P6'] },
      { kw: ['敏捷', 'Scrum', 'Sprint', '看板', 'WIP', '回顾'], topicId: 'agile',
        a: 'Scrum 以固定时间盒（Sprint）组织工作，包含计划会、站会、评审、回顾四个事件；看板是流式方法，核心机制是可视化工作流 + 限制在制品（WIP）以暴露瓶颈。承诺量应基于真实速率（velocity）而非期望。',
        src: ['课程实验指导书.md · 第 2 节'] },
      { kw: ['CI', 'CD', '持续集成', '持续交付', '部署', '蓝绿', '流水线'], topicId: 'cicd',
        a: '持续集成：频繁合并主干并自动构建测试；持续交付：主干始终可发布但由人工触发；持续部署：验证通过后自动发布。流水线建议按「构建 → 静态检查 → 单测 → 集成测试 → 打包 → 部署 → 冒烟」排布，越快越便宜的检查越靠前。蓝绿部署可实现秒级回滚与零停机。',
        src: ['Week06_CI与DevOps.pdf · P2–P5'] },
      { kw: ['git', 'rebase', 'merge', '分支', '冲突'], topicId: 'git',
        a: 'merge 保留分支拓扑并产生合并提交，历史真实；rebase 将提交重放到目标分支，历史线性但改写历史——已推送到公共分支的提交不要 rebase。协作推荐短生命周期特性分支 + Pull Request 评审。冲突需人工判读语义，合并后必须跑测试。',
        src: ['Week04_Git协作.pdf · P6–P10'] },
      { kw: ['Agent', '编排', '工具调用', 'Re-plan', '循环'], topicId: 'agent',
        a: 'Agent 的循环是 Plan → Act → Observe → Update & Re-plan，与「一问一答」的本质区别在于拥有状态与闭环。工具调用让模型突破静态知识限制去执行真实动作；可靠性则来自编排层的约束——最大步数、成本预算与终止条件。',
        src: ['Week10_AI_Agent编排.pdf · P1–P4'] },
    ],
    noHit: '我在已索引的资料中没有找到直接依据。建议：① 换用资料中的原词再问；② 上传包含该内容的资料后重试；③ 到学习主页完成该知识点的讲解。请注意：我不会凭空编造答案。',
  },

  /* ---------- 在线编程实践任务（并入「实践练习」第二阶段） ---------- */
  coding: {
    title: '编程实践任务',
    prompt: '实现一个函数 isBalanced(s)，判断字符串中的 ()、[]、{} 是否成对且嵌套正确。返回 true / false。',
    starter: 'function isBalanced(s) {\n  // 在这里实现\n  \n}',
    tests: [
      { input: '"()"',        expect: 'true',  pass: true },
      { input: '"([{}])"',    expect: 'true',  pass: true },
      { input: '"([)]"',      expect: 'false', pass: false },
      { input: '"((("',       expect: 'false', pass: true },
      { input: '""',          expect: 'true',  pass: true },
    ],
    aiFeedback: [
      '整体思路正确，使用了栈结构，时间复杂度 O(n)。',
      '建议：在遇到右括号时，先检查栈是否为空——当前实现在输入 ")" 时会访问 undefined。',
      '可改进：用一个 map 存括号配对关系，能让代码更简洁易读。',
    ],
  },

  /* ---------- 班级学生（Instructor 视角） ---------- */
  students: [
    { id: 'u01', name: '陈家明', sid: '2103xxxx', cls: 'SE-3A', active: true,  eng: 92, streak: 12 },
    { id: 'u02', name: '林思婷', sid: '2104xxxx', cls: 'SE-3A', active: true,  eng: 78, streak: 6  },
    { id: 'u03', name: '王志豪', sid: '2105xxxx', cls: 'SE-3A', active: true,  eng: 64, streak: 3  },
    { id: 'u04', name: '张慧敏', sid: '2106xxxx', cls: 'SE-3A', active: false, eng: 21, streak: 0  },
    { id: 'u05', name: '李俊杰', sid: '2107xxxx', cls: 'SE-3A', active: true,  eng: 85, streak: 9  },
    { id: 'u06', name: '吴佩珊', sid: '2108xxxx', cls: 'SE-3B', active: true,  eng: 71, streak: 5  },
    { id: 'u07', name: '黄立德', sid: '2109xxxx', cls: 'SE-3B', active: true,  eng: 55, streak: 2  },
    { id: 'u08', name: '周雅琪', sid: '2110xxxx', cls: 'SE-3B', active: true,  eng: 88, streak: 11 },
    { id: 'u09', name: '刘承宇', sid: '2111xxxx', cls: 'SE-3B', active: false, eng: 34, streak: 1  },
    { id: 'u10', name: '徐婉清', sid: '2112xxxx', cls: 'SE-3B', active: true,  eng: 67, streak: 4  },
    { id: 'u11', name: '何俊宏', sid: '2113xxxx', cls: 'SE-3A', active: true,  eng: 49, streak: 2  },
    { id: 'u12', name: '苏晓彤', sid: '2114xxxx', cls: 'SE-3B', active: true,  eng: 96, streak: 15 },
  ],

  /* ---------- 课程（mini-courses） ---------- */
  courses: [
    { id: 'c1', title: '软件工程导论 · 核心概念', topics: 6, students: 42, status: '已发布', updated: '2 天前', author: 'Dr. Chan' },
    { id: 'c2', title: 'Git 与团队协作实战',      topics: 4, students: 38, status: '已发布', updated: '5 天前', author: 'AI 生成 + 人工审核' },
    { id: 'c3', title: '软件测试与质量保障',      topics: 5, students: 31, status: '草稿',   updated: '今天',   author: 'Dr. Chan' },
    { id: 'c4', title: 'AI Agent 编排入门',       topics: 7, students: 19, status: '已发布', updated: '1 周前', author: 'AI 生成 + 人工审核' },
    { id: 'c5', title: '需求工程工作坊',          topics: 5, students: 27, status: '草稿',   updated: '3 天前', author: 'AI 生成 + 人工审核' },
  ],

  /* ---------- 平台运行指标（Admin） ---------- */
  platform: {
    uptime: '99.92%',
    apiLatency: '312 ms',
    llmCallsToday: 8421,
    llmCostToday: 128.4,
    storageMB: 642,
    activeUsers: 137,
    services: [
      { name: 'Web Frontend',   status: 'ok',   note: 'Vercel · 全部区域正常' },
      { name: 'Agent Service',  status: 'ok',   note: 'LangGraph · p95 420ms' },
      { name: 'Vector DB',      status: 'ok',   note: 'ChromaDB · 12.4k 向量' },
      { name: 'State DB',       status: 'ok',   note: 'SQLite · 3.1k 学生状态' },
      { name: 'LLM Provider',   status: 'warn', note: 'OpenAI · 速率接近配额上限' },
      { name: 'Object Storage', status: 'ok',   note: '642 MB / 5 GB' },
    ],
  },
};
