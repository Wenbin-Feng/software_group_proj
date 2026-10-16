import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import {
  answerQuestion,
  copyPublication,
  joinCourse,
  publishNote,
  renameNote,
  restoreState,
  uniqueTitle,
  wikiLinks,
} from './domain';

describe('personal knowledge and community ownership', () => {
  it('copies content into a publication snapshot, not a live private note', () => {
    const state = createSeed();
    const note = state.notes[0];
    const pub = publishNote(note, 'p-test');
    note.content = 'private change';
    expect(pub.content).toContain('Requirements');
    expect(pub.content).not.toBe('private change');
    expect(pub.authorId).toBe(note.ownerId);
  });
  it('copies a publication with attribution and independent identity', () => {
    const state = createSeed();
    const copy = copyPublication(state.publications[0], 'student-2', state.notes, 'copy-1');
    expect(copy.ownerId).toBe('student-2');
    expect(copy.id).toBe('copy-1');
    expect(copy.sourceAuthorId).toBe(state.publications[0].authorId);
    copy.content = 'changed';
    expect(state.publications[0].content).not.toBe('changed');
  });
  it('prevents ambiguous titles including whitespace and case collisions', () => {
    const notes = [{ title: 'Agile' }, { title: 'Agile (2)' }];
    expect(uniqueTitle(' agile ', notes)).toBe('agile (3)');
    expect(uniqueTitle('   ', [])).toBe('Untitled note');
  });
  it('derives actual links and deduplicates case-insensitive targets', () => {
    expect(wikiLinks('[[ Agile ]] and [[agile]] and [[Requirements Analysis]]')).toEqual([
      'Agile',
      'Requirements Analysis',
    ]);
  });
  it('renames links within the owner scope and preserves another user’s notes', () => {
    const state = createSeed();
    state.notes.push({
      id: 'foreign',
      ownerId: 'student-2',
      title: 'Private',
      content: '[[Requirements Analysis]]',
      tags: [],
      updatedAt: '2026-10-15',
    });
    const next = renameNote(
      state.notes,
      'note-requirements',
      'Understanding requirements',
      'student-1',
    );
    expect(next.find((n) => n.id === 'note-lifecycle')!.content).toContain(
      '[[Understanding requirements]]',
    );
    expect(next.find((n) => n.id === 'foreign')!.content).toBe('[[Requirements Analysis]]');
  });
});

describe('demo reliability', () => {
  it('rejects unknown codes and joins only the matching class without duplicates', () => {
    const state = createSeed();
    expect(() => joinCourse(state, 'bad-code', 'student-2')).toThrow('Invalid class code');
    const once = joinCourse(state, ' se2026 ', 'student-2');
    const twice = joinCourse(once, 'SE2026', 'student-2');
    expect(
      twice.memberships.filter((m) => m.userId === 'student-2' && m.courseId === 'se'),
    ).toHaveLength(1);
  });
  it('recovers corrupt JSON and rejects malformed entity shapes', () => {
    expect(restoreState('{bad').recovered).toBe(true);
    expect(restoreState('{"version":1,"users":[{}]}').recovered).toBe(true);
    const seed = createSeed();
    expect(restoreState(JSON.stringify(seed)).recovered).toBe(false);
  });
  it('does not invent source-backed answers for unrelated prompts or uploaded files', () => {
    const state = createSeed();
    const material = state.materials[0];
    expect(answerQuestion('What is the weather?', material).supported).toBe(false);
    expect(
      answerQuestion('Compare waterfall and agile', { ...material, seeded: false }).supported,
    ).toBe(false);
    const answer = answerQuestion('Compare Waterfall and Agile', material);
    expect(answer.supported).toBe(true);
    expect(answer.sourceId).toBe(material.id);
    expect(answer.content).toContain('Agile');
  });

  it('offers recovery when saved records reference a missing instructor or author', () => {
    const state = createSeed();
    state.users = state.users.filter((user) => user.id !== 'instructor-1');
    expect(restoreState(JSON.stringify(state)).recovered).toBe(true);
  });

  it('rejects duplicated record identities and invalid note dates before pages render', () => {
    const duplicateState = createSeed();
    duplicateState.notes.push({ ...duplicateState.notes[0] });
    expect(restoreState(JSON.stringify(duplicateState)).recovered).toBe(true);

    const invalidDateState = createSeed();
    invalidDateState.notes[0].updatedAt = 'not-a-date';
    expect(restoreState(JSON.stringify(invalidDateState)).recovered).toBe(true);
  });
});
