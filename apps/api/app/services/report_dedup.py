"""
Report Deduplication for API Responses

Layer 2 of the 3-layer defense-in-depth strategy.
Groups reports by normalized title and selects the best representative
from each group before sending to the frontend.

Selection criteria (in order):
1. Higher trust_score
2. Has media (images/videos)
3. Longer description
4. More recent created_at
"""

from collections import defaultdict
from typing import List, Dict, Any, Optional
from app.services.news_dedup import NewsDedupService


def deduplicate_reports(
    reports: List[Dict[str, Any]],
    use_normalized_title: bool = True
) -> List[Dict[str, Any]]:
    """
    Deduplicate a list of report dicts by grouping similar titles.

    Args:
        reports: List of report dictionaries (from Report.to_dict())
        use_normalized_title: If True, use pre-computed normalized_title field
                              If False, compute normalization on-the-fly

    Returns:
        Deduplicated list with one representative per title group
    """
    if not reports:
        return []

    # Group by normalized title
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for report in reports:
        if use_normalized_title and report.get('normalized_title'):
            # Use pre-computed normalized title from database
            title_key = report['normalized_title']
        else:
            # Compute on-the-fly (for reports without normalized_title)
            title_key = NewsDedupService.normalize_title(report.get('title', ''))

        if title_key:
            groups[title_key].append(report)
        else:
            # Reports without titles go into their own groups (by ID)
            groups[f"__no_title_{report.get('id', '')}"].append(report)

    # Select best representative from each group
    return [_select_best_report(group) for group in groups.values()]


def _select_best_report(group: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Select the best representative report from a group of duplicates.

    Selection criteria (in order):
    1. Higher trust_score
    2. Has media (images/videos)
    3. Longer description
    4. More recent created_at

    Args:
        group: List of similar/duplicate reports

    Returns:
        The best representative report dict
    """
    if len(group) == 1:
        return group[0]

    def score_report(report: Dict[str, Any]) -> tuple:
        """
        Create a sortable score tuple for a report.
        Higher values = better report.
        """
        trust_score = report.get('trust_score', 0.0) or 0.0

        # Check for media
        media = report.get('media', []) or []
        has_media = 1 if len(media) > 0 else 0

        # Description length
        description = report.get('description', '') or ''
        desc_length = len(description)

        # Created at timestamp (more recent = higher value)
        created_at = report.get('created_at', '')
        # Convert ISO string to sortable value (lexicographic sorting works for ISO dates)
        created_at_score = created_at if isinstance(created_at, str) else ''

        return (trust_score, has_media, desc_length, created_at_score)

    # Sort by score descending and return the best
    sorted_group = sorted(group, key=score_report, reverse=True)
    return sorted_group[0]


def deduplicate_with_stats(
    reports: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Deduplicate reports and return statistics about duplicates found.

    Args:
        reports: List of report dictionaries

    Returns:
        Dict with:
        - reports: deduplicated list
        - original_count: original number of reports
        - deduped_count: number after deduplication
        - duplicates_removed: number of duplicates removed
        - duplicate_groups: list of groups with >1 report (for debugging)
    """
    if not reports:
        return {
            'reports': [],
            'original_count': 0,
            'deduped_count': 0,
            'duplicates_removed': 0,
            'duplicate_groups': []
        }

    # Group by normalized title
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for report in reports:
        if report.get('normalized_title'):
            title_key = report['normalized_title']
        else:
            title_key = NewsDedupService.normalize_title(report.get('title', ''))

        if title_key:
            groups[title_key].append(report)
        else:
            groups[f"__no_title_{report.get('id', '')}"].append(report)

    # Select best from each group
    deduped_reports = [_select_best_report(group) for group in groups.values()]

    # Find groups with duplicates (for debugging/logging)
    duplicate_groups = []
    for title_key, group in groups.items():
        if len(group) > 1:
            duplicate_groups.append({
                'normalized_title': title_key,
                'count': len(group),
                'sources': [r.get('source_domain') or NewsDedupService.extract_source_domain(r.get('source', ''))
                           for r in group],
                'report_ids': [r.get('id') for r in group]
            })

    return {
        'reports': deduped_reports,
        'original_count': len(reports),
        'deduped_count': len(deduped_reports),
        'duplicates_removed': len(reports) - len(deduped_reports),
        'duplicate_groups': duplicate_groups
    }
