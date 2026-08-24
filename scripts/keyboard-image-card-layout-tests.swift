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
            guard KeyboardLayoutMetrics.cardHeight == 164 else {
                throw TestFailure.mismatch("keyboard card row must provide the taller immersive height")
            }
            let cell = KeyboardCardCell(
                frame: CGRect(x: 0, y: 0, width: 152, height: KeyboardLayoutMetrics.cardHeight)
            )
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
            guard header.isHidden else {
                throw TestFailure.mismatch("immersive image card must not show type or time metadata")
            }
            guard let edgeShade = cell.contentView.subviews.first(where: {
                $0.accessibilityIdentifier == "keyboard.imageEdgeShade"
            }), !edgeShade.isHidden, !edgeShade.isUserInteractionEnabled else {
                throw TestFailure.mismatch("immersive image card must show a non-interactive edge shade")
            }
            guard header.frame.height < 30 else {
                throw TestFailure.mismatch("header must stay compact, got \(header.frame)")
            }
            guard imageBody.frame.height > 80 else {
                throw TestFailure.mismatch("image body must fill the remaining card, got \(imageBody.frame)")
            }
            let imageFrame = imageBody.frame
            let cardBounds = cell.contentView.bounds
            guard abs(imageFrame.minX - cardBounds.minX) < 2,
                  abs(imageFrame.minY - cardBounds.minY) < 2,
                  abs(imageFrame.maxX - cardBounds.maxX) < 2,
                  abs(imageFrame.maxY - cardBounds.maxY) < 2
            else {
                throw TestFailure.mismatch("immersive image must fill the entire card, got \(imageBody.frame)")
            }

            let topBar = KeyboardTopBarView(frame: CGRect(x: 0, y: 0, width: 402, height: 46))
            topBar.layoutIfNeeded()
            guard allSubviews(of: topBar).compactMap({ $0 as? UILabel }).isEmpty else {
                throw TestFailure.mismatch("keyboard top bar must not show a centered product title")
            }
            let topButtons = allSubviews(of: topBar).compactMap { $0 as? UIButton }.filter {
                $0.accessibilityIdentifier == "keyboard.searchButton"
                    || $0.accessibilityIdentifier == "keyboard.refreshButton"
            }
            guard topButtons.count == 2 else {
                throw TestFailure.mismatch("keyboard top bar must expose its two standard icon buttons")
            }
            for button in topButtons {
                guard button.backgroundColor === KeyboardSurface.itemUIColor,
                      button.bounds.width == 34,
                      button.bounds.height == 34,
                      button.layer.cornerRadius == button.bounds.height / 2,
                      button.point(inside: CGPoint(x: -5, y: 17), with: nil),
                      !button.point(inside: CGPoint(x: -7, y: 17), with: nil)
                else {
                    throw TestFailure.mismatch("top icon buttons must keep their visuals and expose a larger tap target")
                }
            }

            let actedCard = KeyboardViewCard(
                id: card.id,
                kind: .image,
                kindTitle: "Image",
                title: "Image",
                subtitle: "PNG",
                time: "now",
                sizeText: nil,
                actionConfirmation: "Copied",
                isActing: false,
                didAct: true,
                thumbnailVersion: "v1"
            )
            cell.configure(card: actedCard) { _, _ in nil }
            guard let actedOverlay = cell.contentView.subviews.first(where: {
                $0.accessibilityIdentifier == "keyboard.actedOverlay"
            }),
            allSubviews(of: actedOverlay).compactMap({ $0 as? UILabel }).isEmpty,
            allSubviews(of: actedOverlay).contains(where: {
                ($0 as? UIImageView)?.accessibilityIdentifier == "keyboard.actedIcon"
            }) else {
                throw TestFailure.mismatch("copy feedback must use only a completion icon")
            }

            let idleCard = KeyboardViewCard(
                id: card.id,
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
            cell.configure(card: idleCard) { _, _ in nil }
            guard !actedOverlay.isHidden, actedOverlay.layer.animationKeys()?.isEmpty == false else {
                throw TestFailure.mismatch("copy feedback must animate away instead of disappearing abruptly")
            }

            print("PASS: keyboard image card layout")
        } catch {
            fputs("FAIL: \(error)\n", stderr)
            exit(1)
        }
    }

    private static func allSubviews(of view: UIView) -> [UIView] {
        view.subviews + view.subviews.flatMap(allSubviews)
    }
}
