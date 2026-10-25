# Adaptive Study Assistant Platform

> 一个由生成式 AI 驱动的自适应学习平台，把 AI Tutor 从"被动问答"升级为能根据学生学习状态动态规划学习路径的 Agent。

> **当前仓库状态**：本仓库包含一个**可直接运行的纯前端原型**（无后端依赖）。自适应规划引擎已在 [`js/engine.js`](js/engine.js) 中以客户端逻辑实现，可完整演示 Plan–Act–Observe–Update–Re-plan 闭环。完整后端（LangGraph + ChromaDB + SQLite）为项目愿景，见[开发路线图](#开发路线图)。

[![Course](https://img.shields.io/badge/Course-COMP5241%20(Software%20Engineering)-blue)](#)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)
[![Status](https://img.shields.io/badge/Status-In%20Development-yellow)](#)

---

## 📖 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [目标用户与角色](#目标用户与角色)
- [系统架构](#系统架构)
- [自适应规划工作流](#自适应规划工作流)
- [学习活动类型](#学习活动类型)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [使用指南](#使用指南)
- [开发路线图](#开发路线图)
- [评估方案](#评估方案)
- [AI Fluency (4D 框架)](#ai-fluency-4d-框架)
- [交付物](#交付物)
- [许可证](#许可证)

---

## 项目简介

随着 LLM 的发展，AI Tutor 已能提供课程问答、知识解释和习题讲解。然而传统 LLM-based tutoring systems 通常采用"学生提问—模型回答"的被动交互方式，主要解决学生**当前**的问题，而不是持续分析学习状态并决定**后续**的学习策略。

**Adaptive Study Assistant Platform** 面向**软件工程与开发**相关课程，维护学生在不同知识点上的学习状态，并根据答题结果、错误记录和掌握程度，动态选择下一步学习活动（知识讲解、针对性练习、难度提升、知识复习等）。学生完成活动后，系统根据新反馈更新状态并重新规划，形成 **Plan – Act – Observe – Update – Re-plan** 闭环。

平台同时服务三类角色：

- **Students**：按教师发布的学习路径学习、完成推荐活动（讲解 / 实践 / 复习）、上传自己的课程资料并向 AI 问答助手提问
- **Instructors**：定制现有 mini-course、用 AI 生成新 mini-course、导入学生、追踪参与度与班级知识状态
- **Admins**：管理课程与用户、查看平台整体运行状况

---

## 核心特性

- **🎯 自适应规划引擎**：以 `Student Knowledge Model` 为决策依据，动态决定"下一步该做什么"，而非仅仅回答当前问题。
- **🧠 学生知识模型**：记录各知识点掌握程度、历史答题与错误模式，驱动个性化规划。
- **📚 RAG 知识库**：基于课程材料（Lecture Slides、Tutorial Materials、代码示例）构建向量库，支持知识解释与题目生成。
- **🎯 精简的三类学习活动**：知识点讲解、实践练习（练习 + 浏览器内编程）、知识复习——学生端不再堆叠多种形式，一次只推荐一件事。
- **👩‍🏫 教师工作台**：定制/AI 生成 mini-course、批量导入学生、参与度与班级知识热力图追踪。
- **📚 学习路径 = 已发布课程的依次追加**：学生端知识点来自**全部「已发布」课程**，按发布时间先后排列；每发布一门课，其知识点**追加到已有路径末尾**，原有知识点与进度不被覆盖。同一知识点在多门课中重复时只计入一次；演示初始只有一门已发布课程《软件工程导论 · SE-3A》（5 个知识点），不再预置待审核草稿——想体验「AI 生成 → 审核 → 发布追加」请在教师端现场上传课件生成，AI 生成课程的数量由课件内容动态决定。
- **✨ 教师 AI 生成课程 + 人工审核闭环**：上传课件 → AI 依据课件抽取若干知识点并生成讲解/练习 → 教师逐知识点查看并自主修改 → 审核通过或驳回（均留痕）→ **发布＝追加**到学生学习路径与管理员视图，且**发布后仍可继续修改**。
- **🛡 职责分离的审核治理**：内容审核由授课教师负责；**管理员不审核内容**，只查看只读的审核操作记录。
- **💬 学生资料 + AI 问答助手**：学生可自主上传课程资料，问答助手仅依据「教师发布资料 + 学生上传资料」作答并给出引用出处。

---

## 目标用户与角色

| 角色 | 目标用户 | 核心能力 |
|------|----------|----------|
| **Student** | 需要自主学习软件工程知识的大学生（含非 CS 背景） | 教师发布路径下的个性化推荐、三类活动、资料上传与 AI 问答 |
| **Instructor** | 授课教师 | 课程定制、AI 生成课程、学生导入、参与度追踪 |
| **Admin** | 平台管理员 | 课程与用户管理、整体运行监控 |

平台本身也是 **AI Fluency** 的实践场：学生通过使用平台训练 *Delegation / Description / Discernment / Diligence* 四项能力。

---

## 系统架构

平台由五大核心组件构成：

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│        Student UI  │  Instructor Dashboard  │  Admin        │
└───────────┬───────────────────────┬─────────────────────────┘
            │                       │
            ▼                       ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│  Adaptive Planning   │   │     Instructor & Admin Layer     │
│  Agent (LangGraph)   │   │ 课程定制 / AI 生成 / 追踪 / 管理   │
└──────────┬───────────┘   └──────────────────────────────────┘
           │
   ┌───────┼───────────────────────────────┐
   ▼       ▼                               ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│ Student      │  │ RAG Knowledge   │  │ Multi-format         │
│ Knowledge    │  │ Base (ChromaDB) │  │ Learning Activities  │
│ Model        │  │                 │  │                      │
│ (SQLite)     │  │ LLM (GPT/Claude)│  │ slides / exercise /  │
└──────────────┘  └─────────────────┘  │ sim / roleplay / game│
                                       └──────────────────────┘
```

1. **RAG Knowledge Base** — 基于课程材料构建向量知识库，支持知识解释与题目生成。
2. **Student Knowledge Model** — 记录学生在各知识点上的掌握程度、历史答题、错误模式。
3. **Adaptive Planning Agent** — 基于学生状态选择下一项学习活动（核心引擎）。
4. **Multi-format Learning Activities** — 多种交互形式的学习活动。
5. **Instructor & Admin Layer** — 课程定制、AI 生成 mini-course、学生导入、参与度追踪、班级知识热力图。

---

## 自适应规划工作流

**学生学习循环**

```
Student State → Adaptive Planning → Learning Activity
→ Student Response → Evaluation → State Update → Re-planning
```

Adaptive Planner 依据学生状态在不同活动类型间切换：

| 学生状态 | 选择的活动 |
|----------|-----------|
| 反复出现相同错误（errors ≥ 2 且 mastery < 75） | 知识复习（先纠正错误概念） |
| 掌握不足（mastery < 45） | 知识点讲解 |
| 有一定基础但仍有错误（45 ≤ mastery < 80） | 实践练习（针对性练习 + 编程实践） |
| 掌握较高（mastery ≥ 80） | 知识复习（间隔回顾，维持长期记忆） |

**教师工作循环**

```
Instructor Input (topic / requirements / materials)
→ AI-assisted Course Generation
→ Instructor Refinement (manual or AI)
→ Publish to Students
→ Track Engagement & Knowledge State
→ Adjust Teaching Focus
```

---

## 学习活动类型

学生端刻意保持精简——只保留三种活动，避免选择过载，每种都由 Adaptive Planner 依据掌握度分派：

| 活动形式 | 说明 | 训练能力 |
|----------|------|----------|
| **知识点讲解** | 基于教师发布资料生成的分页讲解，随时可暂停提问 | 知识理解（Description） |
| **实践练习** | 阶段一：按掌握度抽取的针对性练习；阶段二：浏览器内真实运行的编程实践任务 + AI 实时反馈 | 知识应用与编程实践（Delegation） |
| **知识复习** | 针对历史错误的闪卡回顾，完成后清空错误计数 | 巩固纠错（Discernment） |

> 早期原型中的 Interactive simulation / Role play / Bug Hunter / 独立 Online coding 已下线：形式虽多，但学生实际只会用到"学—练—复习"这条主线，因此收敛为上述三类（编程实践并入「实践练习」第二阶段）。

---

## 技术栈

| 组件 | 技术选型 |
|------|----------|
| Agent workflow | LangGraph |
| LLM | GPT-4 / Claude / 开源模型（按成本与效果选择） |
| 向量检索 | ChromaDB |
| 学生状态存储 | SQLite |
| 前端 | React / Next.js |
| 部署 | Vercel（前端）+ 云服务（后端） |

---

## 项目结构

当前仓库为**纯前端原型**，目录如下：

```
polyu-se-hongzhi/
├── index.html              # 原型入口（双击或经本地服务运行）
├── styles.css              # 设计系统与全局样式
├── js/
│   ├── ui.js               # 图标与通用 UI 组件
│   ├── data.js             # 原型 mock 数据（知识点 / 题库 / 讲解等）
│   ├── engine.js           # ★ 知识模型 + 自适应规划 Agent + 课程仓库（发布＝追加）
│   ├── views-student.js    # 学生端视图（学习主页 / 3 类活动 / 资料上传 + AI 问答 / 进度）
│   ├── views-instructor.js # 教师端视图（班级热力图 / AI 课程生成）
│   ├── views-admin.js      # 管理员端视图（平台监控 / 用户 / 内容）
│   └── app.js              # 应用外壳 + hash 路由 + 角色切换
├── server.js               # 零依赖本地静态服务器（npm start）
├── package.json            # 脚本与项目元信息
├── .gitignore
├── LICENSE
└── README.md
```

> 注：完整的后端结构（`backend/` LangGraph Agent + RAG + SQLite、`frontend/` Next.js、`data/`、`scripts/`、`docs/`）将在后续阶段落地，见[开发路线图](#开发路线图)。

---

## 快速开始

### 运行前端原型（当前仓库内容）

本仓库当前包含一个**纯前端原型**，无需安装依赖、无需后端即可运行。

**方式一：本地静态服务（推荐）**

```bash
# 任选其一
npm start                      # 使用仓库内置的零依赖 Node 静态服务器（node server.js）
python -m http.server 8080     # 或使用 Python
```

然后浏览器打开 http://localhost:8080 。

**方式二：直接双击**

直接双击 `index.html` 即可在浏览器打开。注意：部分浏览器在 `file://` 协议下会禁用 `localStorage`，学习进度可能无法保存，建议用方式一。

---

### 完整技术栈（规划中）

> 以下为项目愿景中的完整运行方式，后端代码尚未实现，仅作后续开发参考。

**先决条件**：Node.js ≥ 18 · Python ≥ 3.10 · 一个 LLM API Key（OpenAI / Anthropic）

**1. 克隆仓库**

```bash
git clone <repo-url>
cd polyu-se-hongzhi
```

**2. 后端（Agent + RAG + 状态存储）**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 构建 RAG 知识库（基于 data/ 下的课程材料）
python scripts/build_knowledge_base.py

# 启动 API 服务
uvicorn app.main:app --reload --port 8000
```

**3. 前端**

```bash
cd frontend
npm install
npm run dev
```

前端默认运行于 `http://localhost:3000`，后端 API 默认 `http://localhost:8000`。

---

## 配置说明

> 本节对应规划中的后端服务；当前纯前端原型无需任何配置即可运行。

在 `backend/` 下创建 `.env`：

```env
# LLM 配置（二选一或按策略切换）
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# 向量库与数据库
CHROMA_PERSIST_DIR=./chroma_db
SQLITE_DB_PATH=./student_state.db

# 前端调用地址
BACKEND_API_URL=http://localhost:8000
```

---

## 使用指南

### 学生

1. 完成 **Pre-test** 以获得初始知识状态（后续新追加的知识点只需单独补一次 Pre-test，已有进度不变）。
2. 主页按课程分组展示**教师发布的学习路径**（学生只读）：先发布的课程在前，后发布的追加在后，全部知识点均可学习。
3. Adaptive Planner 推荐下一步活动（讲解 / 实践练习 / 复习），一次只推一件事。
4. 完成活动并提交反馈，系统更新掌握度并 **Re-plan**。
5. 在「课程资料 · AI 问答」中**上传自己的资料**，并向 AI 问答助手提问（回答附带引用出处）。
   > 演示初始只有 **1 份**教师发布资料《软件工程导论_SE-3A_课程讲义.pdf》，与当前唯一课程一一对应；问答引用均指向它，不在资料范围内的问题会明确回答「没有找到依据」而不是编造。

### 教师

1. 在「**AI 生成课程**」中**上传课件**（PDF / PPT / MD 等）→ 填写标题 → AI 依据课件抽取若干知识点并生成每个知识点的讲解与练习。
   > 演示数据保持精简：**1 门课程、1 份课程资料、2 个示例标题、2 条默认审核记录**，其余记录与资料由实际操作/上传产生。
   > 知识点数量由 AI 依课件内容动态决定，**不是固定值**（原型按课件数量 + 内容密度计算，范围 3–8）。
2. 对每个知识点点「**查看**」：可修改名称、简介、讲解每页的标题/要点/总结，以及练习题的题干、选项、正确答案与解析，也可增删页面和题目。
3. 确认无误后「**审核通过并发布**」——**发布＝追加**：新课程的知识点接到学生已有路径末尾，原有知识点、掌握度与学习记录全部保留，仅新增项标记为待 Pre-test；或「**驳回**」并填写原因；两者都会写入审核记录。
4. **发布后仍可继续查看 / 修改**，保存后再次同步到学生端，只影响被修改的那个知识点。
5. 批量**导入学生**；通过参与度与**班级知识热力图**追踪学习状况，调整教学重点。

### 管理员

1. 查看平台整体运行状况、资源使用与最近课程动态。
2. 管理用户账号。
3. 查看全部课程（含教师 AI 生成的课程）与**教师审核记录**。
   > ⚠️ 管理员**不参与内容审核**，只留存"谁在何时审核/驳回/修改了哪门课"的审计记录。

---

## 开发路线图

| 阶段 | 内容 |
|------|------|
| 阶段 1 | 课程资料收集、PDF 处理、RAG knowledge base；实现基础 LLM Tutor 与 RAG Tutor |
| 阶段 2 | Student Knowledge Model；学生学习状态与答题历史记录 |
| 阶段 3 | LangGraph 实现 Adaptive Planning Agent 与 Plan–Act–Observe–Update–Re-plan workflow |
| 阶段 4 | 三类学习活动开发（知识点讲解 / 实践练习含在线编程 / 知识复习） |
| 阶段 5 | Instructor Dashboard、课程定制、AI 生成 mini-course、参与度追踪 |
| 阶段 6 | 整合为可交互平台，部署到公开平台，完成用户测试与结果分析 |

---

## 评估方案

**实验流程（功能验证）**

```
Pre-test → Learning Session → Post-test
```

学生完成 Pre-test 获得初始状态，使用不同 Tutor 方法学习，最后通过 Post-test 衡量效果。

**Baselines**

- **LLM-only Tutor** — 直接 LLM 回答，无课程检索、无自适应规划
- **RAG Tutor** — 使用课程资料检索增强，但不根据学生状态调整策略
- **Fixed-strategy Tutor** — 固定学习流程，不根据表现改变策略
- **Adaptive Study Assistant Agent（本方案）**

**评估指标**

| 指标 | 说明 |
|------|------|
| **Learning Gain** | Pre-test 到 Post-test 的提升 |
| **Final Mastery** | 学习结束后的知识掌握程度 |
| **Learning Efficiency** | 达到目标掌握程度所需的学习活动数量 |
| **Engagement** | 学生参与度（活动完成率、停留时间、回访率） |
| **Instructor Usability** | 教师定制课程与追踪学生的易用性 |
| **Response Time & Cost** | 自适应规划的额外计算开销 |

---

## AI Fluency (4D 框架)

| 维度 | 在项目中的体现 |
|------|----------------|
| **Delegation** | 决定哪些交给 AI（题目生成、答案评估、讲解生成），哪些必须人做（定义学习目标、审核内容质量、最终决策） |
| **Description** | 设计高质量 prompt 生成学习内容与活动；平台也教学生如何清晰描述问题 |
| **Discernment** | 核心活动（如 Bug Hunter）训练学生批判性评估 AI 输出；团队也需评估 AI 生成的代码与内容 |
| **Diligence** | 验证 AI 生成内容正确性、记录 AI 使用、对最终内容负责；平台记录学生学习过程供教师审查 |

**团队工作流中的实践**

- 使用 coding agent 辅助开发，但每个 PR 需人工 review
- 记录哪些代码由 AI 生成、哪些手写
- 对 AI 生成的学习内容进行人工审核
- 在报告中分享使用 coding agent 的经验与教训

---

## 交付物

- 部署到公开平台（Vercel 等）的可交互平台
- 5–8 分钟系统概览视频
- Presentation slides
- Final report（项目概述、系统设计、功能、开发过程、AI 使用、反思）
- User manual（Admin / Instructor / Student）
- 各功能 demo 视频
- GitHub Repository（代码、文档、issue、project board）

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
