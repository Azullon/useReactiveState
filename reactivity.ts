import { observable, observe, unobserve } from '@nx-js/observer-util'
import { FunctionalComponent, options } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'

/**
 * Позволяет отслеживать реактивные зависимости компонента
 * @param component Функциональный компонент Preact
 * @return Переданный компонент в реактивной обёртке
 */
function reactiveComponent<P>(
  component: FunctionalComponent<P>
): FunctionalComponent<P> {
  let reactiveComponent: FunctionalComponent<P> = (props: P) => {
    // Используем useState для получения возможности обновления компонента
    const [, requestRerender] = useState({})
    // create a memoized reactive wrapper of the original component
    // at the very first run of the component function
    const render = useMemo(
      () =>
        observe(component, {
          // React (и Preact тоже) неплохо умеет склеивать setState
          // Поэтому его можно спокойно вызвать хоть миллион раз(буквально)
          scheduler: () => requestRerender({}),
          lazy: true,
        }),
      // В оригинальной либе для React написано, что так надо, чтобы девтулзы не ломались
      [component]
    )

    // После анмаунта компонента очищаем зависимость
    useEffect(() => {
      return () => unobserve(render)
    }, [])

    return render(props)
  }

  reactiveComponent.displayName = component.displayName || component.name

  return reactiveComponent
}

//Используем option hooks для навешивания на компоненты преакта реактивности
let oldVnode = options.vnode
options.vnode = (vnode) => {
  if (typeof vnode.type == 'function')
    vnode.type = reactiveComponent(vnode.type as FunctionalComponent)
  if (oldVnode) oldVnode(vnode)
}

/**
 * Аналог useState. Создаёт реактивное состояние, привязанное к текущему объекту
 * @param initialState Изначальное состояние или функция, которая его создает
 * @return Возвращает реактивную версию состояния, при изменении этого состояния, возвращает измененную версию
 */

export function useReactiveState<T extends Object>(
  initialState: T | (() => T)
) {
  let [state] = useState(() => {
    if (typeof initialState == 'function')
      initialState = (initialState as Function)()
    //initialState может быть очищен GC при удалении компонента
    return observable(initialState as T)
  })
  return state
}

/**
 * Делает объект реактивным. Использовать вне компонентов preact
 * @param object Изначальное состояние
 * @return Возвращает реактивную версию состояния
 */
export function reactive<T extends Object>(object: T) {
  return observable(object)
}
