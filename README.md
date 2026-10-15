# GenAI Learning Platform

软件工程课程项目。项目说明见 [project_overivew.pdf](project_overivew.pdf)，AI 助手与组员的操作约定见 [agent.md](agent.md)。

## 第一阶段目标

四位组员分别探索产品方案，每人独立开发一个可演示的 prototype。阶段结束时，在同一仓库保留四个 `dev/<组员名字>` 分支，每个分支对应一个独立原型。

- 每人独立设计原型的用户场景、功能、界面和技术方案。
- 每个原型围绕课程要求的 GenAI 学习平台展开，说明所解决的学习或教学问题。
- 每个开发分支从全空的孤立分支（orphan branch）开始，拥有独立提交历史。
- 每个开发分支自行编写 `README.md`，记录自己的原型，不复制 `main` 的规则 README 作为原型说明。
- 第一阶段不合并四个原型。课程最终集成应用的方案留待后续阶段确定。

## 分支约定

| 分支 | 用途 |
| --- | --- |
| `main` | 保存课程 PDF、项目规则和阶段目标 |
| `dev/<组员名字>` × 4 | 四位组员各自的独立原型 |

组员名字尚未填写。每人使用自己的姓名或约定的唯一英文名，整个阶段保持一致。

`main` 不放原型代码，不作为原型的代码基线。开发分支不继承、合并或 rebase `main`，也不自动同步其他组员的原型。规则更新在 `main` 查阅，原型说明由各分支自行维护。

## 从空白分支开始

首次开发建议使用单独的新 clone。将下面的仓库地址和 `your-name` 替换为实际值；每人执行一次。

```bash
git clone <仓库地址> polyu-se-your-name
cd polyu-se-your-name
git status --short
```

确认工作区干净后，再执行：

```bash
git switch --orphan dev/your-name
git ls-files
git commit --allow-empty -m "chore: start your-name prototype"
git push -u origin dev/your-name
```

`git switch --orphan` 会移除当前检出的已跟踪文件，开始一段无父提交的历史。此时 `git ls-files` 应无输出，空提交使该分支可以被保存和推送；提交信息中的 `your-name` 也要替换成自己的名字。随后自行创建项目文件、`.gitignore` 和原型 `README.md`。

不要用 `git switch -c dev/your-name main`，该命令会继承 `main` 的文件和历史。如果工作区已有未提交或未跟踪的个人文件，先保留这些内容，或换用新的 clone；不要使用强制切换或清理命令来制造空目录。

分支已存在后，继续开发只需检出该分支，不再创建 orphan 分支：

```bash
git fetch origin
git switch dev/your-name
```

在新的 clone 中首次检出已有远程分支时，使用 `git switch --track origin/dev/your-name`。

以上远程命令在仓库发布并配置 `origin` 后使用。

## 每个原型的 README

至少说明：

1. 原型名称、负责人、目标用户和要解决的问题。
2. 核心功能，以及一条可以完整演示的用户流程。
3. 技术栈、环境要求、依赖安装与启动方式。
4. 必需的环境变量；只提供占位示例，不提交密钥。
5. 演示步骤、截图或链接，以及已知限制。
6. 已进行的验证、用户反馈和主要迭代；尚未验证的内容如实标明。

## 第一阶段完成标准

- 四个按成员姓名命名的开发分支，各自包含一个独立原型。
- 四个分支均从空白历史开始，没有继承 `main` 的规则文件与 PDF。
- 每个原型可以按照本分支 README 启动并完成核心流程演示。
- 每位组员保留自己的提交记录和必要的设计、验证材料，便于比较方案。
- `main` 继续作为项目规则与阶段目标的入口。
