#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/uniclip-keyboard-image-card.XXXXXX")"
trap 'rm -rf "${BUILD_DIR}"' EXIT

MODEL_FILE="${PROJECT_DIR}/targets/keyboard/KeyboardModel.swift"

if ! rg -q 'PayloadCache\.shared\.read\(profileId: "Image-\\\(hash\)"\)' "${MODEL_FILE}"; then
  echo "FAIL: keyboard image reader must use PayloadCache profile Image-<HASH>" >&2
  exit 1
fi

SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
xcrun swiftc \
  -parse-as-library \
  -sdk "${SDK_PATH}" \
  -F "${SDK_PATH}/System/iOSSupport/System/Library/Frameworks" \
  -target arm64e-apple-ios18.0-macabi \
  "${PROJECT_DIR}/targets/keyboard/KeyboardViewState.swift" \
  "${PROJECT_DIR}/targets/keyboard/KeyboardPresentationBehavior.swift" \
  "${PROJECT_DIR}/targets/keyboard/KeyboardCardCell.swift" \
  "${PROJECT_DIR}/scripts/keyboard-image-card-layout-tests.swift" \
  -o "${BUILD_DIR}/keyboard-image-card-layout-tests"

"${BUILD_DIR}/keyboard-image-card-layout-tests"
