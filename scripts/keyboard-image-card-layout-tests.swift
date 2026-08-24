import Foundation
import UIKit

enum KeyboardSurface {
    static let itemUIColor = UIColor.white
}

extension UIFont {
    func withWeight(_ weight: UIFont.Weight) -> UIFont {
        let descriptor = fontDescriptor.addingAttributes([
            .traits: [UIFontDescriptor.TraitKey.weight: weight],
        ])
        return UIFont(descriptor: descriptor, size: pointSize)
    }
}

private enum TestFailure: Error, CustomStringConvertible {
    case mismatch(String)

    var description: String {
        switch self {
        case .mismatch(let message): message
        }
    }
}

@main
private enum KeyboardImageCardLayoutTests {
    @MainActor
    static func main() async {
        do {
            let cell = KeyboardCardCell(frame: CGRect(x: 0, y: 0, width: 152, height: 150))
            let card = KeyboardViewCard(
                id: UUID(),
                kind: .image,
                kindTitle: "Image",
                title: "Image",
                subtitle: "PNG",
                time: "now",
                sizeText: nil,
                actionConfirmation: "Copied",
                isActing: false,
                didAct: false,
                thumbnailVersion: "v1"
            )
            cell.configure(card: card) { _, _ in nil }
            cell.setNeedsLayout()
            cell.layoutIfNeeded()

            guard let header = cell.contentView.subviews.first(where: { $0 is UIStackView }) else {
                throw TestFailure.mismatch("image card header is missing")
            }
            let visibleImages = cell.contentView.subviews.compactMap { $0 as? UIImageView }
                .filter { !$0.isHidden }
            guard let imageBody = visibleImages.max(by: { $0.bounds.height < $1.bounds.height }) else {
                throw TestFailure.mismatch("image card body is missing")
            }

            guard abs(header.frame.minY - 12) < 0.5 else {
                throw TestFailure.mismatch("header must start at y=12, got \(header.frame)")
            }
            guard header.frame.height < 30 else {
                throw TestFailure.mismatch("header must stay compact, got \(header.frame)")
            }
            guard imageBody.frame.height > 80 else {
                throw TestFailure.mismatch("image body must fill the remaining card, got \(imageBody.frame)")
            }

            print("PASS: keyboard image card layout")
        } catch {
            fputs("FAIL: \(error)\n", stderr)
            exit(1)
        }
    }
}
