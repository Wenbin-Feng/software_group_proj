import { BookOpen } from "lucide-react";
import { useApp } from "../context";
import { shareablePages, wikiSnapshot } from "../lib/shareWiki";
import { Modal } from "./ui";

export default function ShareWikis({ open, onClose }) {
  const { data, user, setData, toast, navigate } = useApp();
  if (!open) return null;
  const wikis = (data.notes || []).filter(
    (note) => note.wikiRoot && note.studentId === user.id,
  );
  function share(wiki) {
    const pages = shareablePages(data.notes, wiki, user.id);
    if (!pages.length) {
      toast("This wiki has no pages to share yet.");
      return;
    }
    const snapshot = wikiSnapshot({
      wiki,
      pages,
      market: data.market,
      user,
      notes: data.notes,
    });
    setData((previous) => ({
      ...previous,
      market: [snapshot, ...(previous.market || [])],
    }));
    onClose();
    const course = (data.courses || []).find((item) => item.id === wiki.courseId);
    toast(`Shared “${wiki.title}” to ${course?.code || "the course"}.`);
    navigate("market", { courseId: wiki.courseId });
  }
  return (
    <Modal
      title="Share a wiki"
      subtitle="Choose one. Every page in it is published to that course."
      onClose={onClose}
    >
      <div className="wiki-publish-select wiki-share-list">
        {wikis.length ? (
          wikis.map((wiki) => {
            const course = (data.courses || []).find((item) => item.id === wiki.courseId);
            const count = shareablePages(data.notes, wiki, user.id).length;
            return (
              <button
                type="button"
                className="wiki-select-row"
                key={wiki.id}
                onClick={() => share(wiki)}
              >
                <BookOpen size={16} />
                <span>
                  {wiki.title}
                  <small>
                    {course?.code || "Course"} · {count} page{count === 1 ? "" : "s"}
                  </small>
                </span>
              </button>
            );
          })
        ) : (
          <p>Create a wiki first, then share it here.</p>
        )}
      </div>
    </Modal>
  );
}
