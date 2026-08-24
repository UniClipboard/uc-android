#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/uniclip-keyboard-image-card.XXXXXX")"
trap 'rm -rf "${BUILD_DIR}"' EXIT

MODEL_FILE="${PROJECT_DIR}/targets/keyboard/KeyboardModel.swift"
LIST_FILE="${PROJECT_DIR}/targets/keyboard/KeyboardCardListView.swift"

if ! rg -q 'PayloadCache\.shared\.read\(profileId: "Image-\\\(hash\)"\)' "${MODEL_FILE}"; then
  echo "FAIL: keyboard image reader must use PayloadCache profile Image-<HASH>" >&2
  exit 1
fi

ACTION_RENDER_BLOCK="$(sed -n '/private func renderCardActions/,/private func cardUpdateReason/p' "${LIST_FILE}")"
if ! grep -q 'cardsByID\[card.id\] = card' <<<"${ACTION_RENDER_BLOCK}"; then
  echo "FAIL: card action refresh must publish the latest feedback state before reconfiguring" >&2
  exit 1
fi

if [[ "$(rg -c 'await loadImagePayload\(hash: hash\)' "${MODEL_FILE}")" -lt 2 ]]; then
  echo "FAIL: image preview and tap-to-copy must share the current payload reader" >&2
  exit 1
fi

COPY_BLOCK="$(sed -n '/private func copyImageToPasteboard/,/private func publishPayloadUnavailable/p' "${MODEL_FILE}")"
if ! grep -q 'recordHandledClipboardRevision(UIPasteboard.general.changeCount)' <<<"${COPY_BLOCK}" \
  || grep -q 'history\.touch' <<<"${COPY_BLOCK}" \
  || grep -q 'requestSync(.localClipboardChanged)' <<<"${COPY_BLOCK}"; then
  echo "FAIL: tap-to-copy must keep the card in place and mark its pasteboard write handled" >&2
  exit 1
fi

SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
xcrun swiftc \
  -parse-as-library \
  -sdk "${SDK_PATH}" \
  -F "${SDK_PATH}/System/iOSSupport/System/Library/Frameworks" \
  -target arm64e-apple-ios18.0-macabi \
  "${PROJECT_DIR}/targets/keyboard/KeyboardLayoutMetrics.swift" \
  "${PROJECT_DIR}/targets/keyboard/KeyboardViewState.swift" \
  "${PROJECT_DIR}/targets/keyboard/KeyboardPresentationBehavior.swift" \
  "${PROJECT_DIR}/targets/keyboard/KeyboardCardCell.swift" \
  "${PROJECT_DIR}/targets/keyboard/KeyboardTopBarView.swift" \
  "${PROJECT_DIR}/scripts/keyboard-image-card-layout-tests.swift" \
  -o "${BUILD_DIR}/keyboard-image-card-layout-tests"

"${BUILD_DIR}/keyboard-image-card-layout-tests"
