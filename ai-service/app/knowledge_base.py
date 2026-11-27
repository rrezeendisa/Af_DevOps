import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KNOWLEDGE_PATH = Path(__file__).resolve().parents[1] / "knowledge" / "courses"
SKILL_LABELS = {
    "logica": "lógica",
    "comunicacao": "comunicação",
    "tecnologia": "tecnologia",
}


@dataclass(frozen=True)
class CourseDocument:
    course_id: str
    name: str
    competency: str
    level: str
    prerequisites: str
    description: str
    objectives: str
    source: str

    @property
    def searchable_text(self) -> str:
        return " ".join(
            (
                self.name,
                self.competency,
                SKILL_LABELS[self.competency],
                self.level,
                self.prerequisites,
                self.description,
                self.objectives,
            )
        )


def _field(content: str, field_name: str) -> str:
    match = re.search(rf"^- {re.escape(field_name)}:\s*(.+)$", content, re.MULTILINE)
    if not match:
        raise ValueError(f"Documento de curso sem o campo obrigatório {field_name!r}.")
    return match.group(1).strip()


def _section(content: str, title: str) -> str:
    match = re.search(
        rf"^## {re.escape(title)}\s*\n(.*?)(?=^## |\Z)",
        content,
        re.MULTILINE | re.DOTALL,
    )
    if not match:
        raise ValueError(f"Documento de curso sem a seção {title!r}.")
    return " ".join(line.strip(" -*\t") for line in match.group(1).splitlines()).strip()


def load_course_documents(directory: Path = KNOWLEDGE_PATH) -> list[CourseDocument]:
    documents: list[CourseDocument] = []
    for path in sorted(directory.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        heading = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        if not heading:
            raise ValueError(f"Documento sem título: {path}")
        documents.append(
            CourseDocument(
                course_id=_field(content, "ID"),
                name=heading.group(1).strip(),
                competency=_field(content, "Competência").lower(),
                level=_field(content, "Nível recomendado"),
                prerequisites=_field(content, "Pré-requisitos"),
                description=_section(content, "Descrição"),
                objectives=_section(content, "Objetivos de aprendizagem"),
                source=path.name,
            )
        )
    if not documents:
        raise ValueError(f"Nenhum documento Markdown de curso encontrado em {directory}.")
    return documents


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))


class CourseKnowledgeBase:
    """Recuperação local TF-IDF/cosseno; não chama um modelo generativo."""

    def __init__(self, directory: Path = KNOWLEDGE_PATH) -> None:
        self.documents = load_course_documents(directory)
        self._vectorizer = TfidfVectorizer(
            strip_accents="unicode", ngram_range=(1, 2), token_pattern=r"(?u)\b\w+\b"
        )
        self._matrix = self._vectorizer.fit_transform(
            [document.searchable_text for document in self.documents]
        )

    def search(self, query: str, top_k: int = 5) -> list[tuple[CourseDocument, float]]:
        query_vector = self._vectorizer.transform([query])
        scores = cosine_similarity(query_vector, self._matrix).ravel()
        ranked = sorted(
            enumerate(scores), key=lambda item: (-float(item[1]), self.documents[item[0]].source)
        )
        return [
            (self.documents[index], float(score))
            for index, score in ranked[: max(0, top_k)]
            if score > 0
        ]
